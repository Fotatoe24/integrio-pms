// app/api/bot/check-booking-status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
const BOT_SERVICE_KEY = process.env.BOT_SERVICE_KEY;

function taglishSummary(status: string, unitLabel: string, checkIn: string) {
  switch (status) {
    case "PENDING":
      return `Hi! Sa ngayon ay PENDING pa po ang booking niyo sa Unit ${unitLabel} (${checkIn}). Ire-review po ito ng aming staff at ma-cconfirm na po kapag na-verify na ang payment. Salamat sa paghihintay! 🙏`;
    case "CONFIRMED":
      return `Magandang balita! Confirmed na po ang booking niyo sa Unit ${unitLabel} (${checkIn}). See you po! 🎉`;
    case "CANCELLED":
      return `Ang booking niyo po sa Unit ${unitLabel} ay na-cancel. Kung may tanong po kayo, message lang po kami. 🙏`;
    case "COMPLETED":
      return `Tapos na po ang stay niyo sa Unit ${unitLabel}. Salamat po sa pagpili sa Evangelina's Staycation! 💛`;
    default:
      return `Hindi po namin ma-verify ang status ng booking niyo ngayon. Paki-message na lang po kami directly. 🙏`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${BOT_SERVICE_KEY}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!BOT_OWNER_ID) {
      return NextResponse.json(
        { error: "BOT_OWNER_ID not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { bookingId, unitNumber, guestPhone } = body;

    let query = supabaseAdmin
      .from("Booking")
      .select(
        `"id", "status", "checkIn", "checkOut", "guestName", "guestPhone",
         Property:"propertyId" ( "id", "name", "owner_id" )`
      )
      .eq("Property.owner_id", BOT_OWNER_ID)
      .order("createdAt", { ascending: false })
      .limit(1);

    if (bookingId) {
      // Preferred path: exact lookup
      query = supabaseAdmin
        .from("Booking")
        .select(
          `"id", "status", "checkIn", "checkOut", "guestName", "guestPhone",
           Property:"propertyId" ( "id", "name", "owner_id" )`
        )
        .eq("id", bookingId)
        .eq("Property.owner_id", BOT_OWNER_ID)
        .limit(1);
    } else if (unitNumber && guestPhone) {
      // Fallback path: unit + phone, most recent booking
      query = query
        .ilike("Property.name", `%${unitNumber}%`)
        .eq("guestPhone", guestPhone);
    } else {
      return NextResponse.json(
        { error: "Provide either bookingId, or unitNumber + guestPhone" },
        { status: 400 }
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("check-booking-status query error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        status: "NOT_FOUND",
        status_summary:
          "Hindi po namin makita ang booking niyo. Paki-check po ulit ang details o message niyo na lang po kami. 🙏",
      });
    }

    const booking = data[0] as any;
    const unitLabel = booking.Property?.name ?? unitNumber ?? "";
    const checkInLabel = new Date(booking.checkIn).toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
    });

    return NextResponse.json({
      status: booking.status,
      bookingId: booking.id,
      unit: unitLabel,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status_summary: taglishSummary(booking.status, unitLabel, checkInLabel),
    });
  } catch (err) {
    console.error("check-booking-status error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
