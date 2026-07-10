import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

const STAY_TYPE_ALIASES: Record<string, StayType> = {
  "day (short) 8am-8pm": "Day (Short) 8AM-8PM",
  "night (short) 9pm-7am": "Night (Short) 9PM-7AM",
  "day (long) 2pm-11am": "Day (Long) 2PM-11AM",
  day_short: "Day (Short) 8AM-8PM",
  night_short: "Night (Short) 9PM-7AM",
  day_long: "Day (Long) 2PM-11AM",
  day: "Day (Short) 8AM-8PM",
  daytime: "Day (Short) 8AM-8PM",
  araw: "Day (Short) 8AM-8PM",
  night: "Night (Short) 9PM-7AM",
  overnight: "Night (Short) 9PM-7AM",
  gabi: "Night (Short) 9PM-7AM",
  long: "Day (Long) 2PM-11AM",
  "long stay": "Day (Long) 2PM-11AM",
};

function normalizeStayType(input: string): StayType | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return STAY_TYPE_ALIASES[key] || null;
}

function isWeekendDay(d: Date) {
  const day = d.getDay();
  return day === 5 || day === 6 || day === 0;
}

// Robust parse: handles "YYYY-MM-DD" and messier strings like
// "7/23/26, 3:00 PM GMT+8" — falls back to native Date parsing.
function safeParseDate(input: string): Date | null {
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function manilaDateOnly(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    date
  );
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
  checkInDateOnly: string,
  checkOutDateOnly: string
) {
  const rate = RATES[stayType];
  const start = new Date(checkInDateOnly);
  const end = new Date(checkOutDateOnly);
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
    propertyId,
    unitNumber,
    guestName,
    guestEmail,
    contactNo,
    guestCount,
    platform,
    stayType,
    checkIn,
    checkOut,
    notes,
    psid,
  } = body || {};

  // --- Basic validation ---
  if (!guestName || !checkIn || !checkOut || !stayType) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: guestName, checkIn, checkOut, stayType",
      },
      { status: 400 }
    );
  }

  const normalizedStayType = normalizeStayType(stayType);
  if (!normalizedStayType) {
    return NextResponse.json(
      {
        error: `Invalid stayType. Accepted: day_short, night_short, day_long (or full labels: ${Object.keys(
          RATES
        ).join(", ")})`,
      },
      { status: 400 }
    );
  }

  const checkInParsed = safeParseDate(checkIn);
  const checkOutParsed = safeParseDate(checkOut);
  if (!checkInParsed || !checkOutParsed) {
    return NextResponse.json(
      { error: "checkIn/checkOut could not be parsed as valid dates" },
      { status: 400 }
    );
  }

  const checkInDateOnly = manilaDateOnly(checkInParsed);
  const checkOutDateOnly = manilaDateOnly(checkOutParsed);

  if (new Date(checkOutDateOnly) < new Date(checkInDateOnly)) {
    return NextResponse.json(
      { error: "checkOut must be on or after checkIn" },
      { status: 400 }
    );
  }

  // --- Compute stay fields (based on Manila-normalized dates) ---
  const stayFields = computeStayFields(
    normalizedStayType,
    checkInDateOnly,
    checkOutDateOnly
  );
  const newIn = parseDateTime(checkInDateOnly, stayFields.checkInTime);
  const newOut = parseDateTime(checkOutDateOnly, stayFields.checkOutTime);
  const newIsLong = normalizedStayType.includes("Long");

  // --- Resolve candidate properties ---
  let candidateProperties: { id: string; name: string }[] = [];

  if (propertyId) {
    const { data } = await supabase
      .from("Property")
      .select("id, name")
      .eq("id", propertyId)
      .limit(1);
    candidateProperties = data || [];
  } else if (unitNumber) {
    const { data } = await supabase
      .from("Property")
      .select("id, name")
      .ilike("name", `%${unitNumber}%`)
      .limit(1);
    candidateProperties = data || [];
  } else {
    // Auto-assign: search all properties for this owner
    const { data, error: allPropsErr } = await supabase
      .from("Property")
      .select("id, name")
      .eq("owner_id", process.env.BOT_OWNER_ID);
    if (allPropsErr || !data || data.length === 0) {
      return NextResponse.json(
        { error: "No properties available to check" },
        { status: 500 }
      );
    }
    candidateProperties = data;
  }

  if (candidateProperties.length === 0) {
    return NextResponse.json(
      {
        error: unitNumber
          ? `No property found matching "${unitNumber}"`
          : "No matching property found",
      },
      { status: 404 }
    );
  }

  // --- Find first available unit among candidates ---
  let resolvedProperty: { id: string; name: string } | null = null;
  let lastConflict: any = null;

  for (const prop of candidateProperties) {
    const { data: existing, error: fetchErr } = await supabase
      .from("Booking")
      .select(
        "id, guestName, checkIn, checkOut, checkInTime, checkOutTime, stayType, status, propertyId"
      )
      .eq("propertyId", prop.id)
      .not("status", "in", '("CANCELLED","CHECKED_OUT")');

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const overlapping = (existing || []).filter((b) => {
      const bIn = parseDateTime(b.checkIn, b.checkInTime);
      const bOut = parseDateTime(b.checkOut, b.checkOutTime);
      return newIn < bOut && newOut > bIn;
    });

    const existingHasLong = overlapping.some((b) =>
      (b.stayType || "").includes("Long")
    );
    const blocked =
      overlapping.length > 0 &&
      (newIsLong || existingHasLong || overlapping.length >= 2);

    if (!blocked) {
      resolvedProperty = prop;
      break;
    } else {
      lastConflict = overlapping[0];
    }
  }

  if (!resolvedProperty) {
    return NextResponse.json(
      {
        error: "Fully booked — no units available for these dates",
        conflict: true,
        conflictingBooking: lastConflict,
      },
      { status: 409 }
    );
  }

  // --- Insert booking as PENDING ---
  const bookingPayload = {
    propertyId: resolvedProperty.id,
    guestName,
    guestEmail: guestEmail || null,
    contactNo: contactNo || null,
    guestCount: guestCount ? Number(guestCount) : 1,
    bookedBy: null,
    platform: platform || "Facebook",
    stayType: normalizedStayType,
    checkIn: buildTimestamp(checkInDateOnly, stayFields.checkInTime),
    checkOut: buildTimestamp(checkOutDateOnly, stayFields.checkOutTime),
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
    summary: `Booking request received po! Unit ${
      resolvedProperty.name
    }, ${normalizedStayType}, ${checkInDateOnly} to ${checkOutDateOnly}. Total: ₱${stayFields.totalFee.toLocaleString(
      "en-PH"
    )}. Status: naghihintay pa po ng confirmation 🙏`,
  });
}
