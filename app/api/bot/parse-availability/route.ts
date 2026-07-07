import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { extractDateFromText } from "@/lib/dateExtraction";

// Same 4 units, alphabetical for stable ordering — matches your existing bot/availability route
const PROPERTY_ORDER = ["1116", "1118", "1558", "1845"];

function toDateOnlyString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-bot-service-key");
    if (authHeader !== process.env.BOT_SERVICE_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const rawText: string | undefined = body?.raw_text;

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json(
        { success: false, summary: "Missing raw_text in request." },
        { status: 400 }
      );
    }

    const extracted = extractDateFromText(rawText);

    if (!extracted.date) {
      return NextResponse.json({
        success: false,
        summary:
          "Pasensya na po, hindi po namin ma-gets ang date. Pwede po bang sabihin ulit, e.g. 'available po ba kayo July 10?'",
      });
    }

    const dateStr = toDateOnlyString(extracted.date);

    // --- Reuse your existing slot logic here ---
    // 0 bookings on that date = Available, 1 short-stay = Partial, 2 short-stays or 1 Day Long = Fully Booked
    // Adjust table/column names below to match your actual schema if this differs
    // from your existing bot/availability route.
    // Properties are named e.g. "Unit 1845", not bare "1845" — match by substring, not exact equality
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
          "Sorry, may issue kami sa pag-check ng availability. Please try again later.",
      });
    }

    const DAY_SHORT = "Day (Short) 8AM-8PM";
    const NIGHT_SHORT = "Night (Short) 9PM-7AM";
    const DAY_LONG = "Day (Long) 2PM-11AM";

    const results: { unit: string; status: string; openTypes: string[] }[] = [];

    for (const property of properties ?? []) {
      const { data: bookings, error: bookingError } = await supabaseAdmin
        .from("Booking")
        .select('"stayType", "checkIn"')
        .eq('"propertyId"', property.id)
        .gte('"checkIn"', `${dateStr}T00:00:00`)
        .lt('"checkIn"', `${dateStr}T23:59:59`);

      if (bookingError) throw bookingError;

      let status = "Available";
      let openTypes: string[] = [DAY_SHORT, NIGHT_SHORT, DAY_LONG];

      if (bookings && bookings.length > 0) {
        const hasDayLong = bookings.some((b) => b.stayType === DAY_LONG);
        if (hasDayLong || bookings.length >= 2) {
          status = "Fully Booked";
          openTypes = [];
        } else {
          status = "Partial";
          // One short-stay slot is taken — only the other short-stay type remains open.
          // A Day (Long) is no longer possible once any slot that day is booked.
          const takenType = bookings[0].stayType;
          openTypes = takenType === DAY_SHORT ? [NIGHT_SHORT] : [DAY_SHORT];
        }
      }

      results.push({ unit: property.name, status, openTypes });
    }

    const fullyAvailable = results.some((r) => r.status === "Available");
    const partialUnits = results.filter((r) => r.status === "Partial");

    let summary: string;

    if (fullyAvailable) {
      summary = `Yes po, may available kami sa ${dateStr}! Message us to book. 😊`;
    } else if (partialUnits.length > 0) {
      const distinctOpenTypes = Array.from(
        new Set(partialUnits.flatMap((u) => u.openTypes))
      );
      const typesList = distinctOpenTypes.join(" or ");
      summary = `May available pa po kami sa ${dateStr}, pero ${typesList} na lang po ang bakante. Message us to book! 😊`;
    } else {
      summary = `Pasensya na po, fully booked na po kami sa ${dateStr}. Baka may ibang date po kayo in mind?`;
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      matched_text: extracted.matchedText,
      results,
      summary,
    });
  } catch (err) {
    console.error("parse-availability error:", err);
    return NextResponse.json(
      {
        success: false,
        summary: "Something went wrong checking availability.",
      },
      { status: 500 }
    );
  }
}
