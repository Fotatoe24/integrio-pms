import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Find property by token
  const { data: property, error: propError } = await supabaseAdmin
    .from("Property")
    .select("id, name")
    .eq("ourIcalToken", token)
    .maybeSingle();

  // ADD THIS TEMPORARILY
  console.log("Token received:", JSON.stringify(token));
  console.log("Property found:", property);
  console.log("Prop error:", propError);

  if (propError || !property) {
    // Return empty valid calendar instead of 404
    const empty = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Integrio PMS//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(empty, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Get all non-cancelled bookings
  const { data: bookings } = await supabaseAdmin
    .from("Booking")
    .select("id, guestName, checkIn, checkOut, status")
    .eq("propertyId", property.id)
    .not("status", "eq", "CANCELLED");

  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  // Format as all-day DATE (Airbnb prefers this)
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  };

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Integrio PMS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${property.name}`,
    "X-WR-TIMEZONE:Asia/Manila",
  ];

  for (const b of bookings || []) {
    const start = formatDate(b.checkIn);
    const end = formatDate(b.checkOut);

    // Skip invalid bookings where end <= start
    if (end <= start) {
      console.warn(
        `Skipping booking ${b.id}: DTEND ${end} is not after DTSTART ${start}`
      );
      continue;
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${b.id}@integrio-pms`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDate(b.checkIn)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(b.checkOut)}`);
    lines.push(`SUMMARY:Blocked`);
    lines.push(`STATUS:CONFIRMED`);
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Join with CRLF as required by RFC 5545
  const ics = lines.join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${property.name}.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
