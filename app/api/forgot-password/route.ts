import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { transporter } from "@/lib/mailer";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email)
      return NextResponse.json({ error: "Email required." }, { status: 400 });

    // Check user exists
    const { data: user } = await supabaseAdmin
      .from("User")
      .select("id, name, status")
      .eq("email", email.toLowerCase())
      .single();

    // Always return success to prevent email enumeration
    if (!user || user.status === "revoked") {
      return NextResponse.json({ ok: true });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Save token to user
    await supabaseAdmin
      .from("User")
      .update({
        reset_token: token,
        reset_token_expires: expires.toISOString(),
      })
      .eq("id", user.id);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"Integrio PMS" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Reset your Integrio PMS password",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1a2744;">
          <div style="margin-bottom: 32px;">
            <span style="font-size: 20px; font-weight: 700; color: #1a2744;">Integrio PMS</span>
          </div>
          <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 12px;">Reset your password</h2>
          <p style="color: #8896a5; font-size: 15px; line-height: 1.6; margin-bottom: 28px;">
            Hi ${user.name}, we received a request to reset your password. Click the button below — this link expires in 1 hour.
          </p>
          <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #1a2744, #2cb5b0); color: white; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-size: 14px; font-weight: 600;">
            Reset password →
          </a>
          <p style="color: #8896a5; font-size: 12px; margin-top: 32px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email.<br/>
            This link expires in 1 hour.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
