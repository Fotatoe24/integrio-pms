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

// ManyChat's "Set User Field" steps currently store the short codes below
// (confirmed from the flow: Day_short / Night_short / Day_long) instead of
// the exact RATE_TIMES keys above. Without this map, every fixed-type
// request 400s with "Unknown stayType" before any real availability check
// runs — normalize here so a naming mismatch on the ManyChat side can't
// silently break the whole flow. Accepts case/spacing variants defensively
// since this is the #1 place a typo in ManyChat would go unnoticed.
const STAY_TYPE_ALIASES: Record<string, StayType> = {
  day_short: "Day (Short) 8AM-8PM",
  "day (short)": "Day (Short) 8AM-8PM",
  "day (short) 8am-8pm": "Day (Short) 8AM-8PM",
  night_short: "Night (Short) 9PM-7AM",
  "night (short)": "Night (Short) 9PM-7AM",
  "night (short) 9pm-7am": "Night (Short) 9PM-7AM",
  day_long: "Day (Long) 2PM-11AM",
  "day (long)": "Day (Long) 2PM-11AM",
  "day (long) 2pm-11am": "Day (Long) 2PM-11AM",
  custom: "Custom",
};

function normalizeStayType(raw: string): StayType | null {
  // Exact match against the canonical keys first (fastest path, and covers
  // anyone calling the API directly with the "real" strings).
  if (raw === "Custom" || raw in RATE_TIMES) return raw as StayType;

  const alias = STAY_TYPE_ALIASES[raw.trim().toLowerCase()];
  return alias ?? null;
}

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
  // Lowercased/underscore-tolerant check — existing Booking rows may have
  // been saved with ManyChat's raw field values ("Day_long") rather than
  // the canonical "Day (Long) 2PM-11AM" string, and a case-sensitive
  // .includes("Long") would silently miss those, mis-classifying a real
  // Long booking as a plain "Day" one.
  const normalized = stayType.toLowerCase();
  if (normalized !== "custom") {
    if (normalized.includes("long")) return "Long";
    if (normalized.includes("night")) return "Night";
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

  // An existing Long booking occupies both slots outright, and two
  // separate overlapping bookings means both Day and Night are taken —
  // either way there's genuinely nothing open on this unit.
  if (existingHasLong || overlapping.length >= 2) {
    return {
      status: "Fully Booked",
      openStayType: null,
      requestedTypeAvailable: false,
    };
  }

  // Exactly one non-Long booking overlaps -> one slot is occupied, one is
  // open. This used to short-circuit a Long request straight to "Fully
  // Booked" without ever computing which slot was free — now it falls
  // through to the same Partial branch as everything else, so a Long
  // request that can't fit (it always needs both slots) still surfaces
  // the genuinely-open slot as a downgrade option instead of a flat "no."
  const occupied = overlapping[0];
  const occupiedCategory = resolveCategory(
    occupied.booking.stayType || "",
    occupied.bIn,
    occupied.bOut
  ) as StaySlotCategory;
  const openStayType: StaySlotCategory =
    occupiedCategory === "Day" ? "Night" : "Day";

  // A Long request can never be satisfied by a single open slot — it
  // always needs both Day and Night — so requestedTypeAvailable is always
  // false here regardless of which category is open.
  return {
    status: "Partial",
    openStayType,
    requestedTypeAvailable:
      newCategory === "Long" ? false : newCategory !== occupiedCategory,
  };
}

// ---------------------------------------------------------------------------
// Hour-level alternate-slot suggestion (Custom/Flexible bookings only).
//
// Fixed stay types (Day Short / Night Short / Day Long) keep the old
// "try the other Day/Night category" suggestion further down — their
// windows are pinned to RATES, so shifting them by an hour would produce a
// booking outside the rate card. This search is only meaningful for
// "Custom", where the guest's window is arbitrary to begin with.
//
// Search increment: 1 hour (per Phillip).
// Search scope: forward from the requested check-in time through the end
// of the NEXT calendar day only — if nothing opens up in that window, the
// API falls back to a generic "try a different date" message rather than
// searching further out.
// Duration: preserved from the guest's original request (shifts the start
// time, keeps the same length of stay) — ASSUMPTION, no strong preference
// given. Flip to snapping onto the nearest fixed RATE_TIMES window here if
// that turns out to be the better guest experience.
// ---------------------------------------------------------------------------

const SUGGESTION_SEARCH_INCREMENT_MS = 60 * 60 * 1000; // 1 hour

// Raw time-overlap check (with turnaround buffer), ignoring Day/Night
// category. Used for suggestion search because a Custom slot's actual
// availability is a pure time-window question, not a two-slot-per-day one.
function hasOverlap(
  bookings: ExistingBooking[],
  propertyId: string,
  checkInMs: number,
  checkOutMs: number
): boolean {
  return bookings
    .filter((b) => b.propertyId === propertyId)
    .filter((b) => b.status !== "CANCELLED" && b.status !== "CHECKED_OUT")
    .some((b) => {
      const bIn = parseDateTime(b.checkIn, b.checkInTime);
      const bOut = parseDateTime(b.checkOut, b.checkOutTime);
      return (
        checkInMs < bOut + TURNAROUND_BUFFER_MS &&
        checkOutMs + TURNAROUND_BUFFER_MS > bIn
      );
    });
}

interface SuggestedSlot {
  checkInMs: number;
  checkOutMs: number;
  isNextDay: boolean;
}

function findNextAvailableSlot(
  bookings: ExistingBooking[],
  propertyId: string,
  requestedCheckInMs: number,
  durationMs: number
): SuggestedSlot | null {
  const requestedDayStart = new Date(requestedCheckInMs);
  requestedDayStart.setHours(0, 0, 0, 0);

  // Exclusive upper bound: start of the day AFTER the next day, i.e. the
  // search covers "today (remaining hours)" + "the next full day".
  const searchCutoff = new Date(requestedDayStart);
  searchCutoff.setDate(searchCutoff.getDate() + 2);

  const requestedDayEnd = new Date(requestedDayStart);
  requestedDayEnd.setDate(requestedDayEnd.getDate() + 1);

  let candidateIn = requestedCheckInMs + SUGGESTION_SEARCH_INCREMENT_MS;

  while (candidateIn < searchCutoff.getTime()) {
    const candidateOut = candidateIn + durationMs;
    if (!hasOverlap(bookings, propertyId, candidateIn, candidateOut)) {
      return {
        checkInMs: candidateIn,
        checkOutMs: candidateOut,
        isNextDay: candidateIn >= requestedDayEnd.getTime(),
      };
    }
    candidateIn += SUGGESTION_SEARCH_INCREMENT_MS;
  }

  return null;
}

function formatManilaDateTime(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return { date, time };
}

// "the 18th" style — used in the Day(Long)-downgrade message. Day-of-month
// is pulled via the Manila timezone so it matches what the guest actually
// typed, not whatever local date the server happens to be on.
function ordinalDay(ms: number): string {
  const day = Number(
    new Date(ms).toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      day: "numeric",
    })
  );
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
      ? "nd"
      : day % 10 === 3 && day !== 13
      ? "rd"
      : "th";
  return `${day}${suffix}`;
}

// Guest-facing time range per slot category, for the Day(Long)-downgrade
// message ("...pero Night 9PM-7AM lang is open..."). Keep in sync with
// RATE_TIMES above if the rate card windows ever change.
const CATEGORY_TIME_LABEL: Record<StaySlotCategory, string> = {
  Day: "8AM-8PM",
  Night: "9PM-7AM",
};

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

    const normalizedStayType = normalizeStayType(stayType);
    if (!normalizedStayType) {
      return NextResponse.json(
        {
          error: `Unrecognized stayType: "${stayType}". Expected one of: Day_short, Night_short, Day_long, Custom (or the full RATE_TIMES strings).`,
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

    if (normalizedStayType === "Custom") {
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
      const rateTimes = RATE_TIMES[normalizedStayType];
      if (!rateTimes) {
        return NextResponse.json(
          { error: `Unknown stayType: ${normalizedStayType}` },
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
    //    NOTE: this window is widened below (see checkOutDateOnly cap) to
    //    also cover the next-day suggestion search — a booking that starts
    //    the day after checkOutDateOnly could still block a suggested slot.
    const propertyIds = properties.map((p) => p.id);

    const suggestionSearchEnd = new Date(`${checkOutDateOnly}T00:00:00`);
    suggestionSearchEnd.setDate(suggestionSearchEnd.getDate() + 1);
    const suggestionSearchEndStr = suggestionSearchEnd
      .toISOString()
      .slice(0, 10);

    const { data: bookings, error: bookingError } = await supabase
      .from("Booking")
      .select(
        '"id", "propertyId", "checkIn", "checkInTime", "checkOut", "checkOutTime", "stayType", "status"'
      )
      .in("propertyId", propertyIds)
      .lte("checkIn", suggestionSearchEndStr)
      .gte("checkOut", checkInDateOnly);

    if (bookingError) {
      return NextResponse.json(
        { error: "Could not load bookings", details: bookingError.message },
        { status: 500 }
      );
    }

    const allBookings = (bookings as ExistingBooking[]) ?? [];

    // 5. Run the same slot-conflict logic used on the dashboard for each unit
    const results = properties.map((property) => {
      const conflict = checkConflict(
        allBookings,
        property.id,
        checkInValue,
        checkOutValue,
        normalizedStayType,
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

    // Single machine-readable field for ManyChat's Condition block to
    // switch on, instead of parsing the guest-facing `summary` text:
    //  - BOOKABLE                -> proceed straight to booking confirmation
    //  - PARTIAL_ALTERNATIVE     -> same date works, guest needs to switch
    //                               Day/Night type
    //  - SUGGESTED_ALTERNATIVE_TIME -> Custom flow found a nearby hour or
    //                               next-day opening (see suggestedCheckIn)
    //  - FULLY_BOOKED            -> genuinely nothing available near this
    //                               date -> loop back to the date-picking
    //                               step, don't proceed to booking
    type AvailabilityFlag =
      | "BOOKABLE"
      | "PARTIAL_ALTERNATIVE"
      | "SUGGESTED_ALTERNATIVE_TIME"
      | "FULLY_BOOKED";

    let summary: string;
    let flag: AvailabilityFlag;
    let suggestedCheckIn: string | null = null;
    let suggestedCheckOut: string | null = null;

    if (bookableUnits.length > 0) {
      flag = "BOOKABLE";
      summary =
        "Yes, we have availability for those dates! Want to book? Just reply and our team will help you finish up!";
    } else if (normalizedStayType === "Custom") {
      // Flexible-time request with nothing bookable as-asked — search for
      // the earliest alternate hour (same day, then next day) across all
      // units, rather than falling straight to a generic "different date"
      // message.
      const requestedInMs = parseDateTime(checkInValue, checkInTimeValue);
      const requestedOutMs = parseDateTime(checkOutValue, checkOutTimeValue);
      const durationMs = requestedOutMs - requestedInMs;

      let earliest: SuggestedSlot | null = null;
      for (const property of properties) {
        const slot = findNextAvailableSlot(
          allBookings,
          property.id,
          requestedInMs,
          durationMs
        );
        if (slot && (!earliest || slot.checkInMs < earliest.checkInMs)) {
          earliest = slot;
        }
      }

      if (earliest) {
        const { date, time } = formatManilaDateTime(earliest.checkInMs);
        suggestedCheckIn = new Date(earliest.checkInMs).toISOString();
        suggestedCheckOut = new Date(earliest.checkOutMs).toISOString();
        flag = "SUGGESTED_ALTERNATIVE_TIME";
        summary = earliest.isNextDay
          ? `Sorry po, that exact time isn't available. Pero we do have an opening at ${time} on ${date} — want us to book that instead po?`
          : `Sorry po, that exact time isn't available. Pero we do have an opening at ${time} the same day — want us to book that instead po?`;
      } else {
        // No same-day or next-day slot found at all -> truly nothing
        // bookable near this date, same as the fixed-type fully-booked
        // case below.
        flag = "FULLY_BOOKED";
        summary =
          "Sorry po, we couldn't find an open slot nearby those hours or the next day. Would you like to try a different date instead?";
      }
    } else if (partialButBlockedUnits.length > 0) {
      flag = "PARTIAL_ALTERNATIVE";
      const openTypes = Array.from(
        new Set(partialButBlockedUnits.map((r) => r.openStayType))
      );

      // A Long request (Day Long, or a Custom window that spans both
      // windows) always lands in this branch with requestedTypeAvailable
      // === false, since half a day can never satisfy it — but the
      // guest-facing message needs to say "we can't do the full Day+Night"
      // rather than the generic Day/Night-switch phrasing below.
      const requestedInMs = parseDateTime(checkInValue, checkInTimeValue);
      const requestedOutMs = parseDateTime(checkOutValue, checkOutTimeValue);
      const requestedCategory = resolveCategory(
        normalizedStayType,
        requestedInMs,
        requestedOutMs
      );

      const firstOpenType = openTypes[0];
      if (
        requestedCategory === "Long" &&
        openTypes.length === 1 &&
        firstOpenType
      ) {
        summary = `Sorry po, we can't do the full Day+Night on the ${ordinalDay(
          requestedInMs
        )}, pero ${firstOpenType} ${
          CATEGORY_TIME_LABEL[firstOpenType]
        } lang is open — want that instead?`;
      } else {
        const openTypesText = openTypes.join(" or ");
        // Use the resolved Day/Night category, not the raw stayType —
        // every entry here has requestedTypeAvailable === false, meaning
        // the guest's request landed in whichever category ISN'T open,
        // i.e. the opposite of openStayType. This also avoids ever
        // showing "Custom" (an internal enum value) in a guest-facing
        // message.
        const requestedTypeText = openTypes[0] === "Day" ? "Night" : "Day";
        summary = `Sorry po, ${requestedTypeText} is already booked for those dates. We do have a ${openTypesText} slot open po — want us to check that instead?`;
      }
    } else {
      flag = "FULLY_BOOKED";
      summary =
        "Sorry, we're fully booked for those dates. Would you like to try different dates?";
    }

    // Still return the raw array too, in case it's useful for anything
    // else later (e.g. a paid-plan flow that branches per unit).
    return NextResponse.json({
      results,
      summary,
      flag,
      bookable: flag === "BOOKABLE",
      suggestedCheckIn,
      suggestedCheckOut,
    });
  } catch (err) {
    // Catch-all so ManyChat always gets a real JSON error instead of a
    // blank 500 with no body.
    return NextResponse.json(
      { error: "Unexpected server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
