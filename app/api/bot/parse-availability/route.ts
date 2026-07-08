import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { extractDateFromText } from "@/lib/dateExtraction";
import * as chrono from "chrono-node";

// Same 4 units, alphabetical for stable ordering — matches your existing bot/availability route
const PROPERTY_ORDER = ["1116", "1118", "1558", "1845"];

const DAY_SHORT = "Day (Short) 8AM-8PM";
const NIGHT_SHORT = "Night (Short) 9PM-7AM";
const DAY_LONG = "Day (Long) 2PM-11AM";

const MANILA_REF_HOUR_OFFSET_MS = 0; // reserved if you later need Manila-local reference time for chrono

// ---------- date helpers (date-only, no time-of-day math) ----------

function toDateOnlyString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToDateOnlyString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toDateOnlyString(
    new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
  );
}

// Builds the inclusive list of calendar "nights/days" a stay touches.
// checkin === checkout => single-day stay, just that one date.
// checkin < checkout => range [checkin, checkout), i.e. checkout date itself
// is the departure day and isn't counted as an occupied night.
function buildDateRange(checkinStr: string, checkoutStr: string): string[] {
  const dates: string[] = [];
  let cursor = checkinStr;

  if (checkinStr === checkoutStr) {
    return [checkinStr];
  }

  // safety cap so a bad/huge range can't hang the request
  let guard = 0;
  while (cursor < checkoutStr && guard < 60) {
    dates.push(cursor);
    cursor = addDaysToDateOnlyString(cursor, 1);
    guard++;
  }
  return dates;
}

// Parses a structured "Month DD, YYYY" (or similar) string via chrono-node.
// Returns null if it can't confidently resolve a date.
function parseStructuredDate(input: string): Date | null {
  const results = chrono.parse(input, new Date(), { forwardDate: true });
  if (!results || results.length === 0) return null;
  return results[0].date();
}

// ---------- booking overlap helpers ----------

interface BookingRow {
  stayType: string;
  checkIn: string;
  checkOut: string;
}

// A booking occupies calendar date `dateStr` if its stay spans that date,
// i.e. checkIn-date <= dateStr < checkOut-date. This fixes the earlier bug
// where only bookings whose "checkIn" landed exactly on the queried date
// were counted — multi-night bookings that started earlier but still
// occupy this date were being missed.
function bookingOccupiesDate(booking: BookingRow, dateStr: string): boolean {
  const bookingCheckInDate = toDateOnlyString(new Date(booking.checkIn));
  const bookingCheckOutDate = toDateOnlyString(new Date(booking.checkOut));
  return bookingCheckInDate <= dateStr && dateStr < bookingCheckOutDate;
}

interface DayStatus {
  date: string;
  status: "Available" | "Partial" | "Fully Booked";
  openTypes: string[];
}

function computeDayStatus(bookings: BookingRow[], dateStr: string): DayStatus {
  const occupying = bookings.filter((b) => bookingOccupiesDate(b, dateStr));

  if (occupying.length === 0) {
    return {
      date: dateStr,
      status: "Available",
      openTypes: [DAY_SHORT, NIGHT_SHORT, DAY_LONG],
    };
  }

  const hasDayLong = occupying.some((b) => b.stayType === DAY_LONG);
  if (hasDayLong || occupying.length >= 2) {
    return { date: dateStr, status: "Fully Booked", openTypes: [] };
  }

  const takenType = occupying[0].stayType;
  const openTypes = takenType === DAY_SHORT ? [NIGHT_SHORT] : [DAY_SHORT];
  return { date: dateStr, status: "Partial", openTypes };
}

interface UnitResult {
  unit: string;
  status: "Available" | "Partial" | "Fully Booked";
  openTypes: string[];
  perDate: DayStatus[];
}

// Combines per-date statuses into one overall status for the whole requested
// stay. A multi-night stay needs every requested night open, so:
// - any date Fully Booked => whole range Fully Booked
// - every date Available => whole range Available
// - otherwise => Partial, with openTypes = intersection of open types
//   across all requested dates (the stay type that would work every night)
function combineDayStatuses(perDate: DayStatus[]): {
  status: UnitResult["status"];
  openTypes: string[];
} {
  if (perDate.some((d) => d.status === "Fully Booked")) {
    return { status: "Fully Booked", openTypes: [] };
  }
  if (perDate.every((d) => d.status === "Available")) {
    return {
      status: "Available",
      openTypes: [DAY_SHORT, NIGHT_SHORT, DAY_LONG],
    };
  }
  const intersection = perDate.reduce<string[]>((acc, d) => {
    if (acc.length === 0) return acc;
    return acc.filter((t) => d.openTypes.includes(t));
  }, perDate[0].openTypes);
  return { status: "Partial", openTypes: intersection };
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-bot-service-key");
    if (authHeader !== process.env.BOT_SERVICE_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const rawText: string | undefined = body?.raw_text;
    const checkinDateInput: string | undefined = body?.checkin_date;
    const checkoutDateInput: string | undefined = body?.checkout_date;
    const guestCount: number | undefined = body?.guest_count;

    let checkinDate: Date | null = null;
    let checkoutDate: Date | null = null;
    let matchedText: string | null | undefined;

    // Structured fields take priority when present (this is what ManyChat's
    // date picker / merge tags send). raw_text remains the fallback path for
    // free-text messages like "available po ba kayo July 10?".
    if (checkinDateInput) {
      checkinDate = parseStructuredDate(checkinDateInput);
      checkoutDate = checkoutDateInput
        ? parseStructuredDate(checkoutDateInput)
        : checkinDate;
      matchedText = [checkinDateInput, checkoutDateInput]
        .filter(Boolean)
        .join(" - ");
    } else if (rawText && typeof rawText === "string") {
      const extracted = extractDateFromText(rawText);
      checkinDate = extracted.date ?? null;
      checkoutDate = extracted.date ?? null;
      matchedText = extracted.matchedText;
    }

    if (!checkinDate) {
      return NextResponse.json({
        success: false,
        summary:
          "Pasensya na po, hindi po namin masyadong nakuha yung date niyo 🙏 Pwede po bang paulit-ulit natin, halimbawa 'available po ba kayo July 10?' Salamat po sa pasensya!",
      });
    }

    if (!checkoutDate) {
      // structured checkout_date failed to parse — fall back to a 1-day stay
      checkoutDate = checkinDate;
    }

    const checkinStr = toDateOnlyString(checkinDate);
    const checkoutStr = toDateOnlyString(checkoutDate);

    if (checkoutStr < checkinStr) {
      return NextResponse.json({
        success: false,
        summary:
          "Ay, mukhang nagulo po natin yung dates 😅 Mas maaga po kasi yung checkout kaysa sa checkin. Pwede niyo po ba kaming i-confirm ulit ng tamang check-in and check-out dates? Salamat po!",
      });
    }

    const requestedDates = buildDateRange(checkinStr, checkoutStr);

    // --- Reuse your existing slot logic here ---
    // 0 bookings on a date = Available, 1 short-stay = Partial, 2 short-stays
    // or 1 Day Long = Fully Booked. Adjust table/column names below to match
    // your actual schema if this differs from your existing bot/availability
    // route. Properties are named e.g. "Unit 1845", not bare "1845" — match
    // by substring, not exact equality.
    const nameFilter = PROPERTY_ORDER.map((u) => `name.ilike.%${u}%`).join(",");
    const { data: properties, error: propError } = await supabaseAdmin
      .from("Property")
      .select('"id", "name"')
      .or(nameFilter)
      .order("name", { ascending: true });

    if (propError) throw propError;

    if (!properties || properties.length === 0) {
      console.error(
        "parse-availability: no properties matched PROPERTY_ORDER filter"
      );
      return NextResponse.json({
        success: false,
        summary:
          "Pasensya na po, medyo nagkaproblema kami sa pag-check ng availability namin ngayon 🙏 Pwede po ba ulit mamaya, o pwede rin po kayong mag-message sa amin diretso para tulungan namin kayo agad.",
      });
    }

    const rangeStartStr = requestedDates[0];
    // one extra day past the last requested date so bookings whose checkOut
    // lands exactly on that boundary are still fetched
    const fetchUpperBoundStr = addDaysToDateOnlyString(
      requestedDates[requestedDates.length - 1],
      1
    );

    const results: UnitResult[] = [];

    for (const property of properties) {
      // Fetch every booking that could possibly overlap ANY date in the
      // requested range in one query, then bucket per date in JS — avoids
      // one round trip per date per property.
      const { data: bookings, error: bookingError } = await supabaseAdmin
        .from("Booking")
        .select('"stayType", "checkIn", "checkOut"')
        .eq('"propertyId"', property.id)
        .lt('"checkIn"', `${fetchUpperBoundStr}T00:00:00`)
        .gt('"checkOut"', `${rangeStartStr}T00:00:00`);

      if (bookingError) throw bookingError;

      const bookingRows: BookingRow[] = (bookings ?? []) as BookingRow[];
      const perDate = requestedDates.map((d) =>
        computeDayStatus(bookingRows, d)
      );
      const { status, openTypes } = combineDayStatuses(perDate);

      results.push({ unit: property.name, status, openTypes, perDate });
    }

    const isMultiNight = requestedDates.length > 1;
    const fullyAvailableUnits = results.filter((r) => r.status === "Available");
    const partialUnits = results.filter((r) => r.status === "Partial");

    const rangeLabel = isMultiNight
      ? `${checkinStr} to ${checkoutStr}`
      : checkinStr;

    let summary: string;

    if (fullyAvailableUnits.length > 0) {
      summary = `Good news po! May available pa kami sa ${rangeLabel} 🎉 Message niyo na lang po kami para ma-book natin agad ang unit niyo. 😊`;
    } else if (partialUnits.length > 0) {
      const distinctOpenTypes = Array.from(
        new Set(partialUnits.flatMap((u) => u.openTypes))
      );
      if (distinctOpenTypes.length > 0) {
        const typesList = distinctOpenTypes.join(" or ");
        summary = `May natitira pa pong available slot sa ${rangeLabel} — ${typesList} na lang po ang bukas 🙂 Sulit i-grab agad! Message niyo na po kami para ma-lock natin yung booking niyo.`;
      } else {
        // Partial per-night but no single stay type clears every night in the range
        summary = `May bakante po kami sa ilang araw sa loob ng ${rangeLabel}, pero hindi po kompleto para sa buong stay niyo nang sabay-sabay 🙏 Message niyo na lang po kami at tutulungan namin kayong maghanap ng best option para sa inyo!`;
      }
    } else {
      summary = `Pasensya na po talaga, fully booked na po kami sa ${rangeLabel} 🙏 Gusto niyo po bang i-check natin ang ibang date? Happy to help po kami maghanap ng available slot para sa inyo!`;
    }

    return NextResponse.json({
      success: true,
      checkin_date: checkinStr,
      checkout_date: checkoutStr,
      nights: requestedDates.length,
      matched_text: matchedText,
      guest_count: guestCount ?? null,
      results,
      summary,
    });
  } catch (err) {
    console.error("parse-availability error:", err);
    return NextResponse.json(
      {
        success: false,
        summary:
          "Ay sorry po, may konting problema po kami sa system namin ngayon 🙏 Pwede po ba ninyo kaming i-message ulit mamaya, or diretso na lang po tayo mag-usap dito para matulungan namin kayo agad.",
      },
      { status: 500 }
    );
  }
}
