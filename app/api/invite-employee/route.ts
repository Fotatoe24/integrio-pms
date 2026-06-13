import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/auth";

function generateTempPassword(length = 10) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, role, ownerId, ownerName } = await req.json();

    if (!name || !email || !role || !ownerId) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Check if email already exists in our User table
    const { data: existing } = await supabaseAdmin
      .from("User")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Generate temp password
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    // Insert into our User table
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("User")
      .insert({
        name,
        email,
        role,
        password: hashedPassword,
        owner_id: ownerId,
        status: "invited",
        temp_password: tempPassword,
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !newUser) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create user." },
        { status: 500 }
      );
    }

    // Send invite via Supabase built-in email
    const { error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          name,
          role,
          owner_id: ownerId,
          owner_name: ownerName,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      });

    if (inviteError) {
      console.error("Supabase invite error:", inviteError.message);
      // User was created in our table but email failed
      // Still return success — owner can share credentials manually
      return NextResponse.json({
        ok: true,
        warning:
          "User created but email delivery failed. Share credentials manually.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
