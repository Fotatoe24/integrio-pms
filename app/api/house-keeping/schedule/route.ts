// app/api/housekeeping/schedule/route.ts
// Returns checkouts (today/tomorrow/week) and check-ins (today/tomorrow)
// with guest info, payment status, balance, and per-unit ready/dirty flag.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { manilaDateString, addDaysManila } from "@/lib/manila-time";

export async function GET(req: NextRequest) {
  const ownerId = req.nextUrl.searchParams.get("owner_id");
  const rangeDays = Number(req.nextUrl.searchParams.get("days") || "1"); // 1 = today+tomorrow, 7 = week
  if (!ownerId)
    return NextResponse.json({ error: "Missing owner_id" }, { status: 400 });

  const today = manilaDateString();
  const rangeEnd = addDaysManila(today, rangeDays);

  const { data: properties } = await supabaseAdmin
    .from("Property")
    .select("id, name")
    .eq("owner_id", ownerId);

  const propertyIds = (properties || []).map((p) => p.id);

  const { data: bookings, error } = await supabaseAdmin
    .from("Booking")
    .select("*, Payment(*)")
    .in("propertyId", propertyIds)
    .neq("status", "CANCELLED")
    .gte("checkOut", `${today}T00:00:00`)
    .lte("checkOut", `${rangeEnd}T23:59:59`);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: checkins } = await supabaseAdmin
    .from("Booking")
    .select("*, Payment(*)")
    .in("propertyId", propertyIds)
    .neq("status", "CANCELLED")
    .gte("checkIn", `${today}T00:00:00`)
    .lte("checkIn", `${addDaysManila(today, 1)}T23:59:59`);

  const { data: cleaningStatuses } = await supabaseAdmin
    .from("UnitCleaningStatus")
    .select("*")
    .in("propertyId", propertyIds);

  function balanceFor(b: any) {
    const paid = (b.Payment || [])
      .filter((p: any) => p.status === "PAID" || p.status === "COMPLETED")
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    return Number(b.totalFee || 0) - paid;
  }

  function readyFor(propertyId: string, latestCheckoutISO: string | null) {
    const status = (cleaningStatuses || []).find(
      (c) => c.propertyId === propertyId
    );
    if (!latestCheckoutISO) return true;
    if (!status?.last_cleaned_at) return false;
    return new Date(status.last_cleaned_at) >= new Date(latestCheckoutISO);
  }

  const checkoutList = (bookings || []).map((b) => ({
    ...b,
    date: b.checkOut?.slice(0, 10),
    isToday: b.checkOut?.slice(0, 10) === today,
    isTomorrow: b.checkOut?.slice(0, 10) === addDaysManila(today, 1),
  }));

  const checkinList = (checkins || []).map((b) => {
    const balance = balanceFor(b);
    const ready = readyFor(
      b.propertyId,
      checkoutList.find((c) => c.propertyId === b.propertyId)?.checkOut || null
    );
    return {
      id: b.id,
      propertyId: b.propertyId,
      guestName: b.guestName,
      contactNo: b.contactNo,
      checkIn: b.checkIn,
      date: b.checkIn?.slice(0, 10),
      isToday: b.checkIn?.slice(0, 10) === today,
      isTomorrow: b.checkIn?.slice(0, 10) === addDaysManila(today, 1),
      totalFee: b.totalFee,
      balance,
      paymentStatus:
        balance <= 0
          ? "PAID"
          : balance < Number(b.totalFee || 0)
          ? "PARTIAL"
          : "UNPAID",
      unitReady: ready,
      unitNotReadyFlag: !ready, // owner-visible flag
    };
  });

  return NextResponse.json({
    properties,
    checkouts: checkoutList,
    checkins: checkinList,
    cleaningStatuses,
  });
}
