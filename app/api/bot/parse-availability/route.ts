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
    const { data: properties, error: propError } = await supabaseAdmin
      .from("Property")
      .select('"id", "name"')
      .in("name", PROPERTY_ORDER)
      .order("name", { ascending: true });

    if (propError) throw propError;

    const results: { unit: string; status: string }[] = [];

    for (const property of properties ?? []) {
      const { data: bookings, error: bookingError } = await supabaseAdmin
        .from("Booking")
        .select('"stayType", "checkIn"')
        .eq('"propertyId"', property.id)
        .gte('"checkIn"', `${dateStr}T00:00:00`)
        .lt('"checkIn"', `${dateStr}T23:59:59`);

      if (bookingError) throw bookingError;

      let status = "Available";
      if (bookings && bookings.length > 0) {
        const hasDayLong = bookings.some(
          (b) => b.stayType === "Day (Long) 2PM-11AM"
        );
        if (hasDayLong || bookings.length >= 2) {
          status = "Fully Booked";
        } else {
          status = "Partial";
        }
      }

      results.push({ unit: property.name, status });
    }

    const summary = results
      .map((r) => `Unit ${r.unit}: ${r.status}`)
      .join("\n");

    return NextResponse.json({
      success: true,
      date: dateStr,
      matched_text: extracted.matchedText,
      results,
      summary: `Availability for ${dateStr}:\n${summary}`,
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
