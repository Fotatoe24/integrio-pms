// /api/bot/availability/route.ts
//
// Called by ManyChat's "External Request" action block.
// Add this path to `publicRoutes` in middleware.ts so it skips JWT auth,
// since ManyChat is an external caller, not a logged-in user.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";

// Shared secret ManyChat sends in a header. Set this in ManyChat's
// External Request config under "Headers".
const BOT_SERVICE_KEY = process.env.BOT_SERVICE_KEY!;

// Must match the exact keys used in RATES on the bookings page —
// ManyChat needs to send one of these three strings exactly.
// "Custom" is the 4th value in the Booking.stayType text column — it's what
// gets saved whenever the guest picks Flexible Time, regardless of which
// fixed type they originally tapped. It has no fixed rate times; the actual
// window comes from checkInDateTime/checkOutDateTime instead.
type FixedStayType =
  | "Day (Short) 8AM-8PM"
  | "Night (Short) 9PM-7AM"
  | "Day (Long) 2PM-11AM";

type StayType = FixedStayType | "Custom";

const RATE_TIMES: Record<
  FixedStayType,
  { checkInTime: string; checkOutTime: string }
> = {
  "Day (Short) 8AM-8PM": { checkInTime: "8:00 AM", checkOutTime: "8:00 PM" },
  "Night (Short) 9PM-7AM": { checkInTime: "9:00 PM", checkOutTime: "7:00 AM" },
  "Day (Long) 2PM-11AM": { checkInTime: "2:00 PM", checkOutTime: "11:00 AM" },
};

// "Day (Long)" (and a Custom booking that spans both windows) occupies BOTH
// slots, so it isn't a single category the way Day-Short/Night-Short are —
// it's handled as its own case below.
type StaySlotCategory = "Day" | "Night";

// Standard Day/Night boundaries, per the rate card (8AM-8PM / 9PM-7AM).
// Used only to classify "Custom" bookings, which don't carry Day/Night in
// their stayType string the way the fixed types do — ASSUMPTION, confirm
// with Phillip if Custom should be categorized differently.
function resolveCategory(
  stayType: string,
  checkInMs: number,
  checkOutMs: number
): StaySlotCategory | "Long" {
  if (stayType !== "Custom") {
    if (stayType.includes("Long")) return "Long";
    if (stayType.includes("Night")) return "Night";
    return "Day";
  }

  const base = new Date(checkInMs);
  base.setHours(0, 0, 0, 0);

  const dayStart = new Date(base);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(base);
  dayEnd.setHours(20, 0, 0, 0);

  const nightStart = new Date(base);
  nightStart.setHours(21, 0, 0, 0);
  const nightEnd = new Date(base);
  nightEnd.setDate(nightEnd.getDate() + 1);
  nightEnd.setHours(7, 0, 0, 0);

  const overlapsDay =
    checkInMs < dayEnd.getTime() && checkOutMs > dayStart.getTime();
  const overlapsNight =
    checkInMs < nightEnd.getTime() && checkOutMs > nightStart.getTime();

  if (overlapsDay && overlapsNight) return "Long";
  if (overlapsNight) return "Night";
  return "Day";
}

// Ported from app/dashboard/bookings/page.tsx — keep these two in sync
// if the slot logic ever changes on the dashboard.
//
// Accepts either:
//  - a plain date string ("2026-07-10") + a 12hr rate time ("8:00 AM"), or
//  - a full ISO datetime string ("2026-07-10T20:00:00") as dateStr with
//    timeStr passed as null (time is already embedded in dateStr).
function parseDateTime(dateStr: string, timeStr: string | null): number {
  const date = new Date(dateStr);
  if (!timeStr) return date.getTime();

  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return date.getTime();

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

interface ExistingBooking {
  id: string;
  propertyId: string;
  checkIn: string;
  checkInTime: string | null;
  checkOut: string;
  checkOutTime: string | null;
  stayType: string;
  status: string;
}

interface ConflictResult {
  status: "Available" | "Partial" | "Fully Booked";
  // Only set when status === "Partial": the slot category still open.
  openStayType: StaySlotCategory | null;
  // Whether the SPECIFIC stayType the guest asked about is bookable.
  // A property can be "Partial" overall while the guest's requested type
  // is exactly the one that's taken (e.g. they ask for Night, Night is
  // booked, only Day is open) — this flag distinguishes that case.
  requestedTypeAvailable: boolean;
}

// Minimum gap required between one booking's checkout and the next
// booking's check-in on the same unit (cleaning/turnaround time). Applied
// to every stay type, not just Custom — an overstaying Day guest doesn't
// kill the whole Night slot, it just pushes back the earliest possible
// next check-in by this much. Adjust here if 30min turns out too tight —
// Phillip wasn't sure between 30min and 1hr as of this writing.
const TURNAROUND_BUFFER_MS = 30 * 60 * 1000;

function checkConflict(
  bookings: ExistingBooking[],
  propertyId: string,
  checkIn: string,
  checkOut: string,
  newStayType: string,
  newCheckInTime: string | null,
  newCheckOutTime: string | null
): ConflictResult {
  const newIn = parseDateTime(checkIn, newCheckInTime);
  const newOut = parseDateTime(checkOut, newCheckOutTime);
  const newCategory = resolveCategory(newStayType, newIn, newOut);

  // Compute each existing booking's actual time window once, up front —
  // resolveCategory needs it for "Custom" bookings, not just the overlap
  // check.
  const withTimes = bookings
    .filter((b) => b.propertyId === propertyId)
    .filter((b) => b.status !== "CANCELLED" && b.status !== "CHECKED_OUT")
    .map((b) => ({
      booking: b,
      bIn: parseDateTime(b.checkIn, b.checkInTime),
      bOut: parseDateTime(b.checkOut, b.checkOutTime),
    }));

  // Overlap check with the turnaround buffer added to BOTH sides' checkout
  // times — this means "conflict" now means "starts before the other
  // booking's checkout + buffer", not just "starts before checkout".
  const overlapping = withTimes.filter(
    ({ bIn, bOut }) =>
      newIn < bOut + TURNAROUND_BUFFER_MS && newOut + TURNAROUND_BUFFER_MS > bIn
  );

  if (overlapping.length === 0) {
    return {
      status: "Available",
      openStayType: null,
      requestedTypeAvailable: true,
    };
  }

  const existingHasLong = overlapping.some(
    ({ booking, bIn, bOut }) =>
      resolveCategory(booking.stayType || "", bIn, bOut) === "Long"
  );

  if (newCategory === "Long" || existingHasLong) {
    return {
      status: "Fully Booked",
      openStayType: null,
      requestedTypeAvailable: false,
    };
  }

  if (overlapping.length >= 2) {
    return {
      status: "Fully Booked",
      openStayType: null,
      requestedTypeAvailable: false,
    };
  }

  // Exactly one short-stay booking overlaps (within the buffer) and it
  // isn't Long -> Partial. Figure out which category is occupied so we can
  // tell the guest which one is still open.
  const occupied = overlapping[0];
  const occupiedCategory = resolveCategory(
    occupied.booking.stayType || "",
    occupied.bIn,
    occupied.bOut
  ) as StaySlotCategory;
  const openStayType: StaySlotCategory =
    occupiedCategory === "Day" ? "Night" : "Day";

  return {
    status: "Partial",
    openStayType,
    requestedTypeAvailable: newCategory !== occupiedCategory,
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify the request actually came from ManyChat
    const key = req.headers.get("x-bot-service-key");
    if (key !== BOT_SERVICE_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse what ManyChat sent (mapped from the guest's chat inputs).
    //    A missing/empty/malformed body throws here — caught below instead
    //    of crashing with a blank 500.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body is missing or not valid JSON" },
        { status: 400 }
      );
    }

    const {
      checkInDate,
      checkOutDate,
      checkInDateTime,
      checkOutDateTime,
      stayType,
      ownerId,
    } = body as {
      checkInDate?: string; // "2026-07-10" — required for the 3 fixed stay types
      checkOutDate?: string;
      checkInDateTime?: string; // "2026-07-10T20:00:00" — required when stayType is "Custom"
      checkOutDateTime?: string;
      stayType: StayType; // one of the 3 fixed RATES keys, or "Custom"
      ownerId: string; // scopes to the right owner's properties
    };

    if (!stayType || !ownerId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: stayType and ownerId are always required",
        },
        { status: 400 }
      );
    }

    // "Custom" (Flexible Time) always carries its own exact datetime window.
    // The 3 fixed types always use a plain date + their RATE_TIMES window —
    // they never take checkInDateTime, even if it's sent.
    let checkInValue: string;
    let checkInTimeValue: string | null;
    let checkOutValue: string;
    let checkOutTimeValue: string | null;

    if (stayType === "Custom") {
      if (!checkInDateTime || !checkOutDateTime) {
        return NextResponse.json(
          {
            error:
              "checkInDateTime and checkOutDateTime are required when stayType is 'Custom'",
          },
          { status: 400 }
        );
      }
      checkInValue = checkInDateTime;
      checkInTimeValue = null; // time already embedded in the ISO string
      checkOutValue = checkOutDateTime;
      checkOutTimeValue = null;
    } else {
      const rateTimes = RATE_TIMES[stayType];
      if (!rateTimes) {
        return NextResponse.json(
          { error: `Unknown stayType: ${stayType}` },
          { status: 400 }
        );
      }
      if (!checkInDate || !checkOutDate) {
        return NextResponse.json(
          {
            error:
              "checkInDate and checkOutDate are required for fixed stay types",
          },
          { status: 400 }
        );
      }
      checkInValue = checkInDate;
      checkInTimeValue = rateTimes.checkInTime;
      checkOutValue = checkOutDate;
      checkOutTimeValue = rateTimes.checkOutTime;
    }

    // Plain YYYY-MM-DD slice for the DB query bounds, regardless of which
    // input path was used above.
    const checkInDateOnly = checkInValue.slice(0, 10);
    const checkOutDateOnly = checkOutValue.slice(0, 10);

    // 3. Pull all properties for this owner, in a fixed order.
    //    ManyChat's Response Mapping uses positional JSON paths like
    //    results[0], results[1] — without an explicit order, Supabase
    //    doesn't guarantee row order, which would silently break mapping.
    const { data: properties, error: propError } = await supabase
      .from("Property")
      .select('"id", "name"')
      .eq("owner_id", ownerId)
      .order("name", { ascending: true });

    if (propError || !properties) {
      return NextResponse.json(
        { error: "Could not load properties", details: propError?.message },
        { status: 500 }
      );
    }

    if (properties.length === 0) {
      return NextResponse.json(
        { error: "No properties found for this ownerId" },
        { status: 404 }
      );
    }

    // 4. Pull bookings for these properties that could possibly overlap.
    const propertyIds = properties.map((p) => p.id);
    const { data: bookings, error: bookingError } = await supabase
      .from("Booking")
      .select(
        '"id", "propertyId", "checkIn", "checkInTime", "checkOut", "checkOutTime", "stayType", "status"'
      )
      .in("propertyId", propertyIds)
      .lte("checkIn", checkOutDateOnly)
      .gte("checkOut", checkInDateOnly);

    if (bookingError) {
      return NextResponse.json(
        { error: "Could not load bookings", details: bookingError.message },
        { status: 500 }
      );
    }

    // 5. Run the same slot-conflict logic used on the dashboard for each unit
    const results = properties.map((property) => {
      const conflict = checkConflict(
        (bookings as ExistingBooking[]) ?? [],
        property.id,
        checkInValue,
        checkOutValue,
        stayType,
        checkInTimeValue,
        checkOutTimeValue
      );
      return {
        propertyId: property.id,
        name: property.name,
        status: conflict.status,
        openStayType: conflict.openStayType,
        requestedTypeAvailable: conflict.requestedTypeAvailable,
      };
    });

    // 6. Build one pre-formatted summary string. ManyChat's Free plan caps
    //    custom fields at 3 for non-subscribers, so mapping one field per
    //    property (results[0].status, results[1].status, ...) doesn't
    //    scale. A single "summary" field works regardless of plan tier or
    //    how many properties you add later.
    const bookableUnits = results.filter(
      (r) =>
        r.status === "Available" ||
        (r.status === "Partial" && r.requestedTypeAvailable)
    );

    // Units where the property has a slot open, but it's NOT the type the
    // guest asked for (e.g. they asked for Night, Night is taken, only Day
    // is free). Worth surfacing so they can pivot instead of hearing a
    // flat "no."
    const partialButBlockedUnits = results.filter(
      (r) => r.status === "Partial" && !r.requestedTypeAvailable
    );

    let summary: string;

    if (bookableUnits.length > 0) {
      summary =
        "Yes, we have availability for those dates! Want to book? Just reply and our team will help you finish up!";
    } else if (partialButBlockedUnits.length > 0) {
      const openTypes = Array.from(
        new Set(partialButBlockedUnits.map((r) => r.openStayType))
      );
      const openTypesText = openTypes.join(" or ");
      // Use the resolved Day/Night category, not the raw stayType — every
      // entry here has requestedTypeAvailable === false, meaning the
      // guest's request landed in whichever category ISN'T open, i.e. the
      // opposite of openStayType. This also avoids ever showing "Custom"
      // (an internal enum value) in a guest-facing message.
      const requestedTypeText = openTypes[0] === "Day" ? "Night" : "Day";
      summary = `Sorry po, ${requestedTypeText} is already booked for those dates. We do have a ${openTypesText} slot open po — want us to check that instead?`;
    } else {
      summary =
        "Sorry, we're fully booked for those dates. Would you like to try different dates?";
    }

    // Still return the raw array too, in case it's useful for anything
    // else later (e.g. a paid-plan flow that branches per unit).
    return NextResponse.json({ results, summary });
  } catch (err) {
    // Catch-all so ManyChat always gets a real JSON error instead of a
    // blank 500 with no body.
    return NextResponse.json(
      { error: "Unexpected server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
