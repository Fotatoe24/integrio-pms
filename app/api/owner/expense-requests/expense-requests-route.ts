// app/api/owner/expense-requests/route.ts
//
// Scoping note: ExpenseRequest -> Employee has no owner_id anywhere on
// Employee itself. The only reliable path to an owner is
// Employee.userId -> User.owner_id, and Employee.userId is nullable.
// Any Employee row without a linked User account is invisible to this
// route on purpose — better to hide an orphaned request than leak it
// across owners. If you want employees who never log in (e.g. contractors)
// to be able to submit requests, Employee needs its own owner_id column.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

async function ownerEmployeeIds(ownerId: string) {
  const { data: users } = await supabaseAdmin
    .from("User")
    .select("id")
    .eq("owner_id", ownerId);
  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length === 0) return [];

  const { data: employees } = await supabaseAdmin
    .from("Employee")
    .select("id, name, role, userId")
    .in("userId", userIds);
  return employees ?? [];
}

export async function GET(req: NextRequest) {
  const ownerId = req.nextUrl.searchParams.get("owner_id");
  const status = req.nextUrl.searchParams.get("status"); // optional filter
  if (!ownerId) {
    return NextResponse.json({ error: "Missing owner_id" }, { status: 400 });
  }

  const employees = await ownerEmployeeIds(ownerId);
  const employeeIds = employees.map((e) => e.id);
  if (employeeIds.length === 0) {
    return NextResponse.json({
      requests: [],
      employees: [],
      note:
        "No employees are linked to a login account yet, so there's nothing to scope expense requests to. Employee rows need a userId pointing at a User with this owner_id.",
    });
  }

  let query = supabaseAdmin
    .from("ExpenseRequest")
    .select("*, Property:propertyId(id, name, shortName)")
    .in("employeeId", employeeIds)
    .order("createdAt", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data: requests, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const empById = new Map(employees.map((e) => [e.id, e]));
  const enriched = (requests ?? []).map((r) => ({
    ...r,
    employee: empById.get(r.employeeId) ?? null,
  }));

  return NextResponse.json({ requests: enriched, employees });
}

// Approve or reject. reviewedById should be the owner's own User.id.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, owner_id, action, rejectionReason, reviewedById } = body;

  if (!id || !owner_id || !action) {
    return NextResponse.json(
      { error: "Missing id, owner_id, or action" },
      { status: 400 }
    );
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  // Re-verify this request actually belongs to this owner before allowing
  // the status change — same reasoning as the Bills route.
  const employees = await ownerEmployeeIds(owner_id);
  const employeeIds = new Set(employees.map((e) => e.id));

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("ExpenseRequest")
    .select("id, employeeId")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing || !employeeIds.has(existing.employeeId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "reject" && !rejectionReason) {
    return NextResponse.json(
      { error: "rejectionReason is required to reject a request" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("ExpenseRequest")
    .update({
      status: action === "approve" ? "APPROVED" : "REJECTED",
      rejectionReason: action === "reject" ? rejectionReason : null,
      reviewedById: reviewedById || owner_id,
      reviewedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data });
}
