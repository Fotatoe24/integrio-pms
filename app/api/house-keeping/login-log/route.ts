// app/api/housekeeping/login-log/route.ts
// Call this once, right after a housekeeping user logs in.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { manilaDateString, isAfter7AMManila } from "@/lib/manila-time";

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

  // upsert-by-unique(user_id, log_date): only set time_in if not already set today
  const { data: existing } = await supabaseAdmin
    .from("HousekeepingLog")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(existing); // already logged in today, don't overwrite time_in
  }

  const { data, error } = await supabaseAdmin
    .from("HousekeepingLog")
    .insert({
      user_id: userId,
      owner_id: ownerId,
      log_date: logDate,
      time_in: now.toISOString(),
      is_late: late,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
