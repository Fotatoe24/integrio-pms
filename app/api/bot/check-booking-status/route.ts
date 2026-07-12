import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function taglishSummary(
  status: string,
  unitLabel: string,
  checkInLabel: string
) {
  switch (status) {
    case "PENDING":
      return `Hi! Sa ngayon ay PENDING pa po ang booking niyo sa Unit ${unitLabel} (${checkInLabel}). Ire-review po ito ng aming staff at ma-cconfirm na po kapag na-verify na ang payment. Salamat sa paghihintay! 🙏`;
    case "CONFIRMED":
      return `Magandang balita! Confirmed na po ang booking niyo sa Unit ${unitLabel} (${checkInLabel}). See you po! 🎉`;
    case "CANCELLED":
      return `Ang booking niyo po sa Unit ${unitLabel} ay na-cancel. Kung may tanong po kayo, message lang po kami. 🙏`;
    case "CHECKED_OUT":
      return `Tapos na po ang stay niyo sa Unit ${unitLabel}. Salamat po sa pagpili sa Evangelina's Staycation! 💛`;
    default:
      return `Hindi po namin ma-verify ang status ng booking niyo ngayon. Paki-message na lang po kami directly. 🙏`;
  }
}

export async function POST(req: NextRequest) {
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

  const { bookingId, unitNumber, guestPhone } = body || {};

  let bookingRow: any = null;

  if (bookingId) {
    const { data, error } = await supabase
      .from("Booking")
      .select(
        "id, status, checkIn, checkOut, guestName, contactNo, stayType, totalFee, propertyId, Property(id, name)"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    bookingRow = data;
  } else if (unitNumber && guestPhone) {
    const { data: props } = await supabase
      .from("Property")
      .select("id, name")
      .ilike("name", `%${unitNumber}%`);

    const propIds = (props || []).map((p) => p.id);

    if (propIds.length > 0) {
      const { data, error } = await supabase
        .from("Booking")
        .select(
          "id, status, checkIn, checkOut, guestName, contactNo, stayType, totalFee, propertyId, Property(id, name)"
        )
        .in("propertyId", propIds)
        .eq("contactNo", guestPhone)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      bookingRow = data;
    }
  } else {
    return NextResponse.json(
      { error: "Provide either bookingId, or unitNumber + guestPhone" },
      { status: 400 }
    );
  }

  if (!bookingRow) {
    return NextResponse.json({
      found: false,
      summary:
        "Hindi po namin makita ang booking niyo. Paki-check po ulit ang details o message niyo na lang po kami. 🙏",
    });
  }

  const unitLabel = bookingRow.Property?.name ?? unitNumber ?? "";
  const checkInLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(new Date(bookingRow.checkIn));

  return NextResponse.json({
    found: true,
    booking: {
      id: bookingRow.id,
      status: bookingRow.status,
      unit: unitLabel,
      checkIn: bookingRow.checkIn,
      checkOut: bookingRow.checkOut,
      stayType: bookingRow.stayType,
      totalFee: bookingRow.totalFee,
    },
    summary: taglishSummary(bookingRow.status, unitLabel, checkInLabel),
  });
}
