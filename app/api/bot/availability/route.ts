// /api/bot/availability/route.ts
//
// Called by ManyChat's "External Request" action block.
// Add this path to `publicRoutes` in middleware.ts so it skips JWT auth,
// since ManyChat is an external caller, not a logged-in user.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use the service role key here (server-side only), not the anon key,
// since this route runs with no logged-in user session.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Shared secret ManyChat sends in a header. Set this in ManyChat's
// External Request config under "Headers".
const BOT_SERVICE_KEY = process.env.BOT_SERVICE_KEY!;

type StayType = "Day-Short" | "Night-Short" | "Day-Long";

export async function POST(req: NextRequest) {
  // 1. Verify the request actually came from ManyChat
  const key = req.headers.get("x-bot-service-key");
  if (key !== BOT_SERVICE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse what ManyChat sent (mapped from the guest's chat inputs)
  const body = await req.json();
  const { checkInDate, checkOutDate, stayType, ownerId } = body as {
    checkInDate: string; // "2026-07-10"
    checkOutDate: string; // "2026-07-12"
    stayType: StayType;
    ownerId: string; // scopes to the right owner's properties
  };

  if (!checkInDate || !checkOutDate || !stayType || !ownerId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // 3. Pull all properties for this owner
  const { data: properties, error: propError } = await supabase
    .from("Property")
    .select('"id", "name"')
    .eq("owner_id", ownerId);

  if (propError || !properties) {
    return NextResponse.json(
      { error: "Could not load properties" },
      { status: 500 }
    );
  }

  // 4. For each property, run the same slot-conflict check the app uses.
  //    (Swap this stub for your real checkConflict logic/import.)
  const results = await Promise.all(
    properties.map(async (property) => {
      const status = await checkConflict({
        propertyId: property.id,
        checkInDate,
        checkOutDate,
        stayType,
      });
      return { propertyId: property.id, name: property.name, status };
    })
  );

  // 5. Return a simple, flat JSON shape ManyChat can map with JSON Path
  //    (e.g. $.results[0].status) into custom fields or reply text.
  return NextResponse.json({ results });
}

// Placeholder — replace with your actual slot logic (0/1/2 model).
async function checkConflict(params: {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  stayType: StayType;
}): Promise<"Available" | "Partial" | "Fully Booked"> {
  const { data: bookings } = await supabase
    .from("Booking")
    .select('"id", "checkIn", "checkOut", "stayType"')
    .eq("propertyId", params.propertyId)
    .lte("checkIn", params.checkOutDate)
    .gte("checkOut", params.checkInDate);

  const count = bookings?.length ?? 0;

  if (count === 0) return "Available";
  if (count === 1 && params.stayType !== "Day-Long") return "Partial";
  return "Fully Booked";
}
