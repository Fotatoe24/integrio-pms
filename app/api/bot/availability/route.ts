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
type StayType =
  | "Day (Short) 8AM-8PM"
  | "Night (Short) 9PM-7AM"
  | "Day (Long) 2PM-11AM";

const RATE_TIMES: Record<
  StayType,
  { checkInTime: string; checkOutTime: string }
> = {
  "Day (Short) 8AM-8PM": { checkInTime: "8:00 AM", checkOutTime: "8:00 PM" },
  "Night (Short) 9PM-7AM": { checkInTime: "9:00 PM", checkOutTime: "7:00 AM" },
  "Day (Long) 2PM-11AM": { checkInTime: "2:00 PM", checkOutTime: "11:00 AM" },
};

// Ported from app/dashboard/bookings/page.tsx — keep these two in sync
// if the slot logic ever changes on the dashboard.
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

function checkConflict(
  bookings: ExistingBooking[],
  propertyId: string,
  checkIn: string,
  checkOut: string,
  newStayType: string,
  newCheckInTime: string,
  newCheckOutTime: string
): "Available" | "Partial" | "Fully Booked" {
  const newIn = parseDateTime(checkIn, newCheckInTime);
  const newOut = parseDateTime(checkOut, newCheckOutTime);
  const newIsLong = newStayType.includes("Long");

  const overlapping = bookings.filter((b) => {
    if (b.propertyId !== propertyId) return false;
    if (b.status === "CANCELLED" || b.status === "CHECKED_OUT") return false;
    const bIn = parseDateTime(b.checkIn, b.checkInTime);
    const bOut = parseDateTime(b.checkOut, b.checkOutTime);
    return newIn < bOut && newOut > bIn;
  });

  if (overlapping.length === 0) return "Available";

  const existingHasLong = overlapping.some((b) =>
    (b.stayType || "").includes("Long")
  );
  if (newIsLong || existingHasLong) return "Fully Booked";
  if (overlapping.length >= 2) return "Fully Booked";

  return "Partial";
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

    const { checkInDate, checkOutDate, stayType, ownerId } = body as {
      checkInDate: string; // "2026-07-10"
      checkOutDate: string; // "2026-07-12"
      stayType: StayType; // must exactly match one of the RATES keys
      ownerId: string; // scopes to the right owner's properties
    };

    if (!checkInDate || !checkOutDate || !stayType || !ownerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const rateTimes = RATE_TIMES[stayType];
    if (!rateTimes) {
      return NextResponse.json(
        { error: `Unknown stayType: ${stayType}` },
        { status: 400 }
      );
    }

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
      .lte("checkIn", checkOutDate)
      .gte("checkOut", checkInDate);

    if (bookingError) {
      return NextResponse.json(
        { error: "Could not load bookings", details: bookingError.message },
        { status: 500 }
      );
    }

    // 5. Run the same slot-conflict logic used on the dashboard for each unit
    const results = properties.map((property) => {
      const status = checkConflict(
        (bookings as ExistingBooking[]) ?? [],
        property.id,
        checkInDate,
        checkOutDate,
        stayType,
        rateTimes.checkInTime,
        rateTimes.checkOutTime
      );
      return { propertyId: property.id, name: property.name, status };
    });

    // 6. Build one pre-formatted summary string. ManyChat's Free plan caps
    //    custom fields at 3 for non-subscribers, so mapping one field per
    //    property (results[0].status, results[1].status, ...) doesn't
    //    scale. A single "summary" field works regardless of plan tier or
    //    how many properties you add later.
    const summary = results.map((r) => `${r.name}: ${r.status}`).join("\n");

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
