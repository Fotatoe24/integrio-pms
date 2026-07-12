// app/api/owner/redflags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { manilaDateString } from "@/lib/manila-time";

export async function GET(req: NextRequest) {
  const ownerId = req.nextUrl.searchParams.get("owner_id");
  if (!ownerId)
    return NextResponse.json({ error: "Missing owner_id" }, { status: 400 });

  const today = manilaDateString();
  const flags: any[] = [];

  // 1. Punctuality
  const { data: staff } = await supabaseAdmin
    .from("User")
    .select("id, name")
    .eq("owner_id", ownerId)
    .eq("role", "housekeeping");

  const { data: logs } = await supabaseAdmin
    .from("HousekeepingLog")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("log_date", today);

  for (const s of staff || []) {
    const log = (logs || []).find((l) => l.user_id === s.id);
    if (log?.is_late) {
      flags.push({
        type: "PUNCTUALITY",
        severity: "warn",
        message: `${s.name} logged in late today`,
      });
    } else if (!log) {
      flags.push({
        type: "PUNCTUALITY",
        severity: "warn",
        message: `${s.name} hasn't logged in yet today`,
      });
    }
  }

  // 2 & 3. Dirty unit with check-in today, and unpaid balance past check-in
  const { data: properties } = await supabaseAdmin
    .from("Property")
    .select("id, name")
    .eq("owner_id", ownerId);
  const propertyIds = (properties || []).map((p) => p.id);

  const { data: bookings } = await supabaseAdmin
    .from("Booking")
    .select("*, Payment(*)")
    .in("propertyId", propertyIds)
    .neq("status", "CANCELLED");

  const { data: cleaningStatuses } = await supabaseAdmin
    .from("UnitCleaningStatus")
    .select("*")
    .in("propertyId", propertyIds);

  for (const b of bookings || []) {
    const checkInDate = b.checkIn?.slice(0, 10);
    const paid = (b.Payment || [])
      .filter((p: any) => p.status === "PAID" || p.status === "COMPLETED")
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const balance = Number(b.totalFee || 0) - paid;

    if (checkInDate === today) {
      const latestCheckout = bookings!
        .filter(
          (x) =>
            x.propertyId === b.propertyId && x.checkOut?.slice(0, 10) <= today
        )
        .sort((a, c) => (a.checkOut > c.checkOut ? -1 : 1))[0]?.checkOut;
      const status = (cleaningStatuses || []).find(
        (c) => c.propertyId === b.propertyId
      );
      const ready =
        !latestCheckout ||
        (status?.last_cleaned_at &&
          new Date(status.last_cleaned_at) >= new Date(latestCheckout));
      if (!ready) {
        const prop = properties?.find((p) => p.id === b.propertyId);
        flags.push({
          type: "DIRTY_UNIT",
          severity: "danger",
          message: `${prop?.name}: guest checking in today but unit not cleaned`,
        });
      }
    }

    if (checkInDate && checkInDate < today && balance > 0) {
      const prop = properties?.find((p) => p.id === b.propertyId);
      flags.push({
        type: "UNPAID_BALANCE",
        severity: "danger",
        message: `${prop?.name}: ${
          b.guestName
        } checked in ${checkInDate} with ₱${balance.toLocaleString()} unpaid`,
      });
    }
  }

  return NextResponse.json({ flags });
}
