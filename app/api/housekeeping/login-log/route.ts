import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { manilaDateString, isAfter7AMManila } from "@/lib/manila-time";

// Manila has no DST and is a fixed UTC+8 offset, so 5:00 PM Manila on any
// given date is always 09:00 UTC that same date — no timezone library needed.
function manila5PMISO(logDate: string): string {
  return `${logDate}T09:00:00.000Z`;
}

// Read-only fetch — used by the dashboard badge, never creates/modifies a row.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId)
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const logDate = manilaDateString();
  const { data } = await supabaseAdmin
    .from("HousekeepingLog")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();

  return NextResponse.json(data || null);
}

// Called once at login. Idempotent — if today's row already exists, returns
// it unchanged. time_out is fixed to 5:00 PM Manila at creation; it's not
// meant to reflect an actual event, just a standard end-of-shift marker.
export async function POST(req: NextRequest) {
  const { userId, ownerId } = await req.json();
  if (!userId || !ownerId) {
    return NextResponse.json(
      { error: "Missing userId/ownerId" },
      { status: 400 }
    );
  }

  const now = new Date();
  const logDate = manilaDateString(now);
  const late = isAfter7AMManila(now);

  const { data: existing } = await supabaseAdmin
    .from("HousekeepingLog")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(existing);
  }

  const { data, error } = await supabaseAdmin
    .from("HousekeepingLog")
    .insert({
      user_id: userId,
      owner_id: ownerId,
      log_date: logDate,
      time_in: now.toISOString(),
      time_out: manila5PMISO(logDate),
      is_late: late,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
