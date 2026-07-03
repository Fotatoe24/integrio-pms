import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  syncPropertyIcal,
  updateSyncStatus,
} from "@/lib/icalSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: properties, error } = await supabaseAdmin
    .from("Property")
    .select("id, name, airbnbIcalUrl")
    .eq("autoSyncEnabled", true)
    .not("airbnbIcalUrl", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const property of properties || []) {
    try {
      const result = await syncPropertyIcal(
        property.id,
        property.airbnbIcalUrl
      );
      await updateSyncStatus(property.id, "success");
      results.push({ propertyId: property.id, name: property.name, ...result });
    } catch (err) {
      await updateSyncStatus(property.id, "error", String(err));
      results.push({
        propertyId: property.id,
        name: property.name,
        error: String(err),
      });
    }
  }

  return NextResponse.json({ success: true, synced: results.length, results });
}
