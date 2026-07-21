// app/api/owner/bills/route.ts
//
// Scoping note: Bill.propertyId is nullable in the schema, but this route
// REQUIRES it on create — there's no other reliable owner_id path for a
// Bill row, so an unscoped bill can never be safely shown/hidden per owner.
// If you want org-wide bills not tied to a unit later, that needs its own
// owner_id column on Bill rather than relying on propertyId.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

async function ownerPropertyIds(ownerId: string) {
  const { data } = await supabaseAdmin
    .from("Property")
    .select("id, name, shortName, unitNumber")
    .eq("owner_id", ownerId);
  return data ?? [];
}

export async function GET(req: NextRequest) {
  const ownerId = req.nextUrl.searchParams.get("owner_id");
  const month = req.nextUrl.searchParams.get("month"); // "YYYY-MM-01"
  if (!ownerId) {
    return NextResponse.json({ error: "Missing owner_id" }, { status: 400 });
  }

  const properties = await ownerPropertyIds(ownerId);
  const propertyIds = properties.map((p) => p.id);
  if (propertyIds.length === 0) {
    return NextResponse.json({ bills: [], properties: [] });
  }

  let query = supabaseAdmin
    .from("Bill")
    .select("*")
    .in("propertyId", propertyIds)
    .order("month", { ascending: false });

  if (month) query = query.eq("month", month);

  const { data: bills, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach property display name client-side without a second round trip.
  const propById = new Map(properties.map((p) => [p.id, p]));
  const enriched = (bills ?? []).map((b) => ({
    ...b,
    property: propById.get(b.propertyId) ?? null,
  }));

  return NextResponse.json({ bills: enriched, properties });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    owner_id,
    propertyId,
    key,
    label,
    month,
    dueDay,
    recurring,
    amountDue,
    accountNumber,
    note,
  } = body;

  if (!owner_id || !propertyId || !key || !month || amountDue == null) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: owner_id, propertyId, key, month, amountDue",
      },
      { status: 400 }
    );
  }

  // Verify the property actually belongs to this owner before allowing the
  // insert — otherwise any caller who knows a propertyId could write bills
  // onto someone else's unit.
  const { data: property, error: propError } = await supabaseAdmin
    .from("Property")
    .select("id")
    .eq("id", propertyId)
    .eq("owner_id", owner_id)
    .maybeSingle();

  if (propError || !property) {
    return NextResponse.json(
      { error: "Property not found for this owner" },
      { status: 403 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("Bill")
    .insert({
      propertyId,
      key,
      label: label || null,
      month,
      dueDay: dueDay ?? null,
      recurring: !!recurring,
      amountDue: Number(amountDue),
      amountPaid: null,
      paid: false,
      accountNumber: accountNumber || null,
      note: note || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bill: data });
}

// Mark paid / update amount / edit note. Ownership re-verified through the
// bill's own propertyId -> Property.owner_id, same reasoning as POST.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, owner_id, amountPaid, paid, note, receiptUrl } = body;

  if (!id || !owner_id) {
    return NextResponse.json(
      { error: "Missing id or owner_id" },
      { status: 400 }
    );
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("Bill")
    .select("id, propertyId, Property:propertyId(owner_id)")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }
  const belongsToOwner =
    (existing as any).Property?.owner_id === owner_id;
  if (!belongsToOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = {};
  if (amountPaid !== undefined) update.amountPaid = amountPaid;
  if (paid !== undefined) {
    update.paid = paid;
    update.paidAt = paid ? new Date().toISOString() : null;
  }
  if (note !== undefined) update.note = note;
  if (receiptUrl !== undefined) update.receiptUrl = receiptUrl;

  const { data, error } = await supabaseAdmin
    .from("Bill")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bill: data });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const ownerId = req.nextUrl.searchParams.get("owner_id");
  if (!id || !ownerId) {
    return NextResponse.json(
      { error: "Missing id or owner_id" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("Bill")
    .select("id, Property:propertyId(owner_id)")
    .eq("id", id)
    .maybeSingle();

  if (!existing || (existing as any).Property?.owner_id !== ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("Bill").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
