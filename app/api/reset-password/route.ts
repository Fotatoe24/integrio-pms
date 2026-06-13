import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    // Find user with valid token
    const { data: user } = await supabaseAdmin
      .from("User")
      .select("id, reset_token_expires")
      .eq("reset_token", token)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset link." },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > new Date(user.reset_token_expires)) {
      return NextResponse.json(
        { error: "Reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Hash new password and clear token
    const hashed = await hashPassword(password);
    await supabaseAdmin
      .from("User")
      .update({
        password: hashed,
        reset_token: null,
        reset_token_expires: null,
        temp_password: null,
        status: "active",
      })
      .eq("id", user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
