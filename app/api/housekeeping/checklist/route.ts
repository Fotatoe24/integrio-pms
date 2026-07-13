// app/api/housekeeping/checklist/route.ts
// GET: fetch (or lazily create) today's/any-date's checklist instance for a unit
// POST: toggle an item / mark instance complete (which sets UnitCleaningStatus)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { manilaDateString } from "@/lib/manila-time";

export async function GET(req: NextRequest) {
  const ownerId = req.nextUrl.searchParams.get("owner_id");
  const propertyId = req.nextUrl.searchParams.get("propertyId");
  const date = req.nextUrl.searchParams.get("date") || manilaDateString();
  if (!ownerId || !propertyId) {
    return NextResponse.json(
      { error: "Missing owner_id/propertyId" },
      { status: 400 }
    );
  }

  const { data: checklist } = await supabaseAdmin
    .from("Checklist")
    .select("*, ChecklistItem(*)")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!checklist) return NextResponse.json({ checklist: null, items: [] });

  let { data: instance } = await supabaseAdmin
    .from("ChecklistInstance")
    .select("*, ChecklistInstanceItem(*)")
    .eq("checklistId", checklist.id)
    .eq("propertyId", propertyId)
    .eq("instance_date", date)
    .maybeSingle();

  if (!instance) {
    const { data: newInstance } = await supabaseAdmin
      .from("ChecklistInstance")
      .insert({
        checklistId: checklist.id,
        propertyId,
        owner_id: ownerId,
        instance_date: date,
      })
      .select()
      .single();

    const items = (checklist.ChecklistItem || []).map((ci: any) => ({
      instanceId: newInstance.id,
      checklistItemId: ci.id,
    }));
    if (items.length)
      await supabaseAdmin.from("ChecklistInstanceItem").insert(items);

    const { data: reloaded } = await supabaseAdmin
      .from("ChecklistInstance")
      .select("*, ChecklistInstanceItem(*)")
      .eq("id", newInstance.id)
      .single();
    instance = reloaded;
  }

  return NextResponse.json({
    checklist,
    items: checklist.ChecklistItem.sort(
      (a: any, b: any) => a.sort_order - b.sort_order
    ),
    instance,
  });
}

export async function POST(req: NextRequest) {
  const { instanceItemId, isChecked, userId, instanceId, allItemIds } =
    await req.json();

  if (instanceItemId) {
    await supabaseAdmin
      .from("ChecklistInstanceItem")
      .update({
        is_checked: isChecked,
        checked_by: isChecked ? userId : null,
        checked_at: isChecked ? new Date().toISOString() : null,
      })
      .eq("id", instanceItemId);
  }

  // check if all items for this instance are now checked -> mark unit clean
  const { data: itemsState } = await supabaseAdmin
    .from("ChecklistInstanceItem")
    .select("is_checked")
    .eq("instanceId", instanceId);

  const items = itemsState || [];
  const allDone = items.length > 0 && items.every((i) => i.is_checked);

  if (allDone) {
    const { data: instance } = await supabaseAdmin
      .from("ChecklistInstance")
      .select("propertyId, owner_id")
      .eq("id", instanceId)
      .single();

    if (!instance) return NextResponse.json({ allDone });

    await supabaseAdmin
      .from("ChecklistInstance")
      .update({
        completed_by: userId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", instanceId);

    await supabaseAdmin.from("UnitCleaningStatus").upsert(
      {
        propertyId: instance.propertyId,
        owner_id: instance.owner_id,
        last_cleaned_by: userId,
        last_cleaned_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "propertyId" }
    );
  }

  return NextResponse.json({ allDone });
}
