import { NextRequest, NextResponse } from "next/server";
import { syncPropertyIcal, updateSyncStatus } from "@/lib/icalSync";

export async function POST(req: NextRequest) {
  try {
    const { propertyId, airbnbIcalUrl } = await req.json();

    if (!airbnbIcalUrl) {
      return NextResponse.json(
        { error: "No iCal URL provided" },
        { status: 400 }
      );
    }

    const result = await syncPropertyIcal(propertyId, airbnbIcalUrl);
    await updateSyncStatus(propertyId, "success");

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
