import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { manilaDateString } from "@/lib/manila-time";

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

// Custom (Flexible Time) bookings don't have their own rate row — they
// borrow the weekday/weekend rate + base-hour count from whichever
// category (Day/Night/Long) their actual time range resolves to, then add
// ₱150/hr for every hour beyond that category's base hours. See
// resolveCategory() / computeCustomFields() below.
const CATEGORY_BASE_RATE = {
  Day: RATES["Day (Short) 8AM-8PM"],
  Night: RATES["Night (Short) 9PM-7AM"],
  Long: RATES["Day (Long) 2PM-11AM"],
} as const;
const CUSTOM_OVERAGE_PER_HOUR = 150;

type FixedStayType = keyof typeof RATES;
type StayType = FixedStayType | "Custom";

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
  custom: "Custom",
  flexible: "Custom",
  "flexible time": "Custom",
  flexi: "Custom",
  "flexi time": "Custom",
};

function normalizeStayType(input: string): StayType | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return STAY_TYPE_ALIASES[key] || null;
}

// Weekday/weekend must reflect the MANILA calendar date, not whatever the
// JS Date's own day-of-week happens to be — that depends on server-local
// time for a raw instant (e.g. 2026-07-10T16:30:00Z is already July 11 in
// Manila), which would pick the wrong weekday/weekend rate right at the
// day boundary.
function isWeekendManila(date: Date): boolean {
  const manilaDate = manilaDateString(date);
  const [y, m, d] = manilaDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 5 || day === 6 || day === 0; // Fri, Sat, Sun
}

// Robust parse: handles "YYYY-MM-DD" and messier strings like
// "7/23/26, 3:00 PM GMT+8" — falls back to native Date parsing.
function safeParseDate(input: string): Date | null {
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function formatManilaTime12h(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// BUG FIX: the old version did `new Date(dateStr); date.setHours(hours, ...)`.
// setHours() sets the hour in the SERVER's local timezone — on Vercel's
// default UTC runtime, that silently stores every fixed-type booking's
// time 8 hours off from the intended Manila wall-clock time. This version
// builds the UTC instant directly from Manila components instead, so it's
// correct regardless of what timezone the server process runs in.
function parseDateTime(dateStr: string, timeStr: string | null): number {
  if (!timeStr) return new Date(dateStr).getTime();

  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return new Date(dateStr).getTime();

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  // Resolve dateStr to its Manila CALENDAR date first — handles both a
  // plain "YYYY-MM-DD" and a full timestamp whose UTC date portion might
  // actually belong to the next/previous Manila day (e.g. 16:30 UTC is
  // already past midnight in Manila). Manila is a fixed UTC+8 with no DST,
  // so local hour - 8 = UTC hour.
  const manilaDate = manilaDateString(new Date(dateStr));
  const [y, m, d] = manilaDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d, hours - 8, minutes, 0, 0);
}

function buildTimestamp(dateStr: string, timeStr: string): string {
  return new Date(parseDateTime(dateStr, timeStr)).toISOString();
}

// "Day (Long)" (and a Custom booking that spans both windows) occupies BOTH
// slots — it isn't a single Day/Night category the way the two Short types
// are. Ported from /api/bot/availability/route.ts — keep these two in sync.
type StaySlotCategory = "Day" | "Night";

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

  // BUG FIX: previously built via `new Date(...); date.setHours(...)`,
  // which sets the hour in the SERVER's local timezone — wrong on Vercel's
  // UTC runtime. Build each boundary as a UTC instant representing the
  // Manila wall-clock time directly (Manila is a fixed UTC+8, no DST).
  const manilaDate = manilaDateString(new Date(checkInMs));
  const [y, m, d] = manilaDate.split("-").map(Number);

  const dayStart = Date.UTC(y, m - 1, d, 8 - 8, 0, 0, 0); // 8:00 AM Manila
  const dayEnd = Date.UTC(y, m - 1, d, 20 - 8, 0, 0, 0); // 8:00 PM Manila
  const nightStart = Date.UTC(y, m - 1, d, 21 - 8, 0, 0, 0); // 9:00 PM Manila
  const nightEnd = Date.UTC(y, m - 1, d + 1, 7 - 8, 0, 0, 0); // 7:00 AM Manila next day

  const overlapsDay = checkInMs < dayEnd && checkOutMs > dayStart;
  const overlapsNight = checkInMs < nightEnd && checkOutMs > nightStart;

  if (overlapsDay && overlapsNight) return "Long";
  if (overlapsNight) return "Night";
  return "Day";
}

// Minimum gap required between one booking's checkout and the next
// booking's check-in on the same unit (cleaning/turnaround time). Ported
// from /api/bot/availability/route.ts — keep these two in sync. Adjust here
// if 30min turns out too tight.
const TURNAROUND_BUFFER_MS = 30 * 60 * 1000;

function computeStayFields(
  stayType: FixedStayType,
  checkInDateOnly: string,
  checkOutDateOnly: string
) {
  const rate = RATES[stayType];
  // checkInDateOnly/checkOutDateOnly are already Manila-correct "YYYY-MM-DD"
  // strings (via manilaDateString), so parsing them as UTC midnight and
  // walking forward in whole-day UTC increments stays correct regardless
  // of server timezone — no local .getDate()/.setDate() involved.
  const start = new Date(checkInDateOnly);
  const end = new Date(checkOutDateOnly);
  const nightsCount = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000)
  );

  let totalFee = 0;
  for (let i = 0; i < nightsCount; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    totalFee += isWeekendManila(d) ? rate.weekend : rate.weekday;
  }

  return {
    checkInTime: rate.checkIn,
    checkOutTime: rate.checkOut,
    hoursStayed: rate.hours * nightsCount,
    totalFee,
  };
}

// Custom (Flexible Time): base rate + hours borrowed from whichever
// category (Day/Night/Long) the actual time range resolves to; ₱150/hr for
// every hour beyond that category's base hour count. No discount if the
// stay is shorter than the base hours (per Phillip: an 11hr or 3hr custom
// stay still costs the full base rate). Overage is billed in whole-hour
// increments (rounded up) — flag if per-minute proration is wanted instead.
function computeCustomFields(checkInParsed: Date, checkOutParsed: Date) {
  const checkInMs = checkInParsed.getTime();
  const checkOutMs = checkOutParsed.getTime();
  const hoursStayed =
    Math.round(((checkOutMs - checkInMs) / 3600000) * 100) / 100;

  const category = resolveCategory("Custom", checkInMs, checkOutMs);
  const baseRate = CATEGORY_BASE_RATE[category];
  const baseFee = isWeekendManila(checkInParsed)
    ? baseRate.weekend
    : baseRate.weekday;
  const overageHours = Math.max(0, Math.ceil(hoursStayed - baseRate.hours));
  const totalFee = baseFee + overageHours * CUSTOM_OVERAGE_PER_HOUR;

  return {
    checkInTime: formatManilaTime12h(checkInParsed),
    checkOutTime: formatManilaTime12h(checkOutParsed),
    hoursStayed,
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
        error: `Invalid stayType. Accepted: day_short, night_short, day_long, custom (or full labels: ${Object.keys(
          RATES
        ).join(", ")}, Custom)`,
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

  const checkInDateOnly = manilaDateString(checkInParsed);
  const checkOutDateOnly = manilaDateString(checkOutParsed);

  if (new Date(checkOutDateOnly) < new Date(checkInDateOnly)) {
    return NextResponse.json(
      { error: "checkOut must be on or after checkIn" },
      { status: 400 }
    );
  }

  // --- Compute stay fields + the actual instants used for conflict checks ---
  // Fixed types force their own RATE_TIMES window (guest's actual time is
  // only used to derive the date). "Custom" uses the guest's actual chosen
  // time as-is — that's the whole point of Flexible Time.
  let stayFields: {
    checkInTime: string;
    checkOutTime: string;
    hoursStayed: number;
    totalFee: number;
  };
  let newIn: number;
  let newOut: number;

  if (normalizedStayType === "Custom") {
    stayFields = computeCustomFields(checkInParsed, checkOutParsed);
    newIn = checkInParsed.getTime();
    newOut = checkOutParsed.getTime();
  } else {
    stayFields = computeStayFields(
      normalizedStayType,
      checkInDateOnly,
      checkOutDateOnly
    );
    newIn = parseDateTime(checkInDateOnly, stayFields.checkInTime);
    newOut = parseDateTime(checkOutDateOnly, stayFields.checkOutTime);
  }

  const newCategory = resolveCategory(normalizedStayType, newIn, newOut);

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

    // Compute each existing booking's actual time window once — needed for
    // both the overlap check and resolveCategory (Custom bookings need
    // their actual times to be classified).
    const withTimes = (existing || []).map((b) => ({
      booking: b,
      bIn: parseDateTime(b.checkIn, b.checkInTime),
      bOut: parseDateTime(b.checkOut, b.checkOutTime),
    }));

    // Turnaround buffer applied to both sides' checkout times, same as the
    // availability endpoint.
    const overlapping = withTimes.filter(
      ({ bIn, bOut }) =>
        newIn < bOut + TURNAROUND_BUFFER_MS &&
        newOut + TURNAROUND_BUFFER_MS > bIn
    );

    const existingHasLong = overlapping.some(
      ({ booking, bIn, bOut }) =>
        resolveCategory(booking.stayType || "", bIn, bOut) === "Long"
    );

    // Bug fix: previously a single overlapping short-stay booking was
    // NEVER treated as blocking, even if it was the SAME category as the
    // new request (e.g. Night overlapping Night) — that silently allowed
    // double-booking the same slot. Now it only counts as non-blocking if
    // the one overlap is a DIFFERENT category (genuinely the other slot).
    const sameCategoryConflict =
      overlapping.length === 1 &&
      resolveCategory(
        overlapping[0].booking.stayType || "",
        overlapping[0].bIn,
        overlapping[0].bOut
      ) === newCategory;

    const blocked =
      overlapping.length > 0 &&
      (newCategory === "Long" ||
        existingHasLong ||
        overlapping.length >= 2 ||
        sameCategoryConflict);

    if (!blocked) {
      resolvedProperty = prop;
      break;
    } else {
      lastConflict = overlapping[0]?.booking ?? null;
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
    checkIn:
      normalizedStayType === "Custom"
        ? checkInParsed.toISOString()
        : buildTimestamp(checkInDateOnly, stayFields.checkInTime),
    checkOut:
      normalizedStayType === "Custom"
        ? checkOutParsed.toISOString()
        : buildTimestamp(checkOutDateOnly, stayFields.checkOutTime),
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
