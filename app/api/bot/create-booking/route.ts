import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Keep this in sync with the RATES table in app/dashboard/bookings/page.tsx
const RATES = {
  "Day (Short) 8AM-8PM": {
    hours: 12,
    checkIn: "8:00 AM",
    checkOut: "8:00 PM",
    weekday: 1499,
    weekend: 1699,
  },
  "Night (Short) 9PM-7AM": {
    hours: 10,
    checkIn: "9:00 PM",
    checkOut: "7:00 AM",
    weekday: 1199,
    weekend: 1299,
  },
  "Day (Long) 2PM-11AM": {
    hours: 21,
    checkIn: "2:00 PM",
    checkOut: "11:00 AM",
    weekday: 1699,
    weekend: 1899,
  },
} as const;

type StayType = keyof typeof RATES;

function isWeekendDay(d: Date) {
  const day = d.getDay();
  return day === 5 || day === 6 || day === 0;
}

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

function buildTimestamp(dateStr: string, timeStr: string): string {
  return new Date(parseDateTime(dateStr, timeStr)).toISOString();
}

function computeStayFields(
  stayType: StayType,
  checkIn: string,
  checkOut: string
) {
  const rate = RATES[stayType];
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nightsCount = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000)
  );

  let totalFee = 0;
  for (let i = 0; i < nightsCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    totalFee += isWeekendDay(d) ? rate.weekend : rate.weekday;
  }

  return {
    checkInTime: rate.checkIn,
    checkOutTime: rate.checkOut,
    hoursStayed: rate.hours * nightsCount,
    totalFee,
  };
}

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.BOT_SERVICE_KEY}`;
  if (!process.env.BOT_SERVICE_KEY || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    propertyId, // preferred: exact Property.id
    unitNumber, // fallback: e.g. "1116" — resolved via ilike
    guestName,
    guestEmail,
    contactNo,
    guestCount,
    platform, // Facebook / TikTok / Instagram etc.
    stayType, // must match one of the RATES keys
    checkIn, // "YYYY-MM-DD"
    checkOut, // "YYYY-MM-DD"
    notes,
    psid, // Facebook PSID, stored in notes for traceability
  } = body || {};

  // --- Validation ---
  if (!guestName || !checkIn || !checkOut || !stayType) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: guestName, checkIn, checkOut, stayType",
      },
      { status: 400 }
    );
  }
  if (!RATES[stayType as StayType]) {
    return NextResponse.json(
      {
        error: `Invalid stayType. Must be one of: ${Object.keys(RATES).join(
          ", "
        )}`,
      },
      { status: 400 }
    );
  }
  if (new Date(checkOut) < new Date(checkIn)) {
    return NextResponse.json(
      { error: "checkOut must be on or after checkIn" },
      { status: 400 }
    );
  }
  if (!propertyId && !unitNumber) {
    return NextResponse.json(
      { error: "Provide either propertyId or unitNumber" },
      { status: 400 }
    );
  }

  // --- Resolve property ---
  let resolvedPropertyId = propertyId;
  if (!resolvedPropertyId) {
    const { data: propMatch, error: propErr } = await supabase
      .from("Property")
      .select("id, name")
      .ilike("name", `%${unitNumber}%`)
      .limit(1);
    if (propErr || !propMatch || propMatch.length === 0) {
      return NextResponse.json(
        { error: `No property found matching "${unitNumber}"` },
        { status: 404 }
      );
    }
    resolvedPropertyId = propMatch[0].id;
  }

  // --- Compute stay fields ---
  const stayFields = computeStayFields(stayType as StayType, checkIn, checkOut);
  const newIn = parseDateTime(checkIn, stayFields.checkInTime);
  const newOut = parseDateTime(checkOut, stayFields.checkOutTime);
  const newIsLong = (stayType as string).includes("Long");

  // --- Conflict check (mirrors checkConflict in bookings page) ---
  const { data: existing, error: fetchErr } = await supabase
    .from("Booking")
    .select(
      "id, guestName, checkIn, checkOut, checkInTime, checkOutTime, stayType, status, propertyId"
    )
    .eq("propertyId", resolvedPropertyId)
    .not("status", "in", '("CANCELLED","CHECKED_OUT")');

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const overlapping = (existing || []).filter((b) => {
    const bIn = parseDateTime(b.checkIn, b.checkInTime);
    const bOut = parseDateTime(b.checkOut, b.checkOutTime);
    return newIn < bOut && newOut > bIn;
  });

  if (overlapping.length > 0) {
    const existingHasLong = overlapping.some((b) =>
      (b.stayType || "").includes("Long")
    );
    if (newIsLong || existingHasLong || overlapping.length >= 2) {
      return NextResponse.json(
        {
          error: "Fully booked for these dates",
          conflict: true,
          conflictingBooking: overlapping[0],
        },
        { status: 409 }
      );
    }
  }

  // --- Insert booking as PENDING ---
  const bookingPayload = {
    propertyId: resolvedPropertyId,
    guestName,
    guestEmail: guestEmail || null,
    contactNo: contactNo || null,
    guestCount: guestCount ? Number(guestCount) : 1,
    bookedBy: null, // unattributed — came in via bot, not staff
    platform: platform || "Facebook",
    stayType,
    checkIn: buildTimestamp(checkIn, stayFields.checkInTime),
    checkOut: buildTimestamp(checkOut, stayFields.checkOutTime),
    checkInTime: stayFields.checkInTime,
    checkOutTime: stayFields.checkOutTime,
    hoursStayed: stayFields.hoursStayed,
    totalFee: stayFields.totalFee,
    status: "PENDING",
    source: "BOT",
    notes:
      [notes, psid ? `PSID: ${psid}` : null].filter(Boolean).join(" | ") ||
      null,
  };

  const { data: created, error: insertErr } = await supabase
    .from("Booking")
    .insert(bookingPayload)
    .select()
    .single();

  if (insertErr || !created) {
    return NextResponse.json(
      { error: insertErr?.message || "Failed to create booking" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    booking: created,
    summary: `Booking request received for ${guestName}, ${checkIn} to ${checkOut}. Status: PENDING confirmation.`,
  });
}
