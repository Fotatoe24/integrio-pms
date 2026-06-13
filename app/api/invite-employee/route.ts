import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/auth";
import nodemailer from "nodemailer";

function generateTempPassword(length = 10) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { name, email, role, ownerId, ownerName } = await req.json();

    if (!name || !email || !role || !ownerId) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Check if email already exists
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

    // Insert into User table
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

    // Send email via Gmail SMTP
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";

    try {
      await transporter.sendMail({
        from: `"Integrio PMS" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `You've been invited to Integrio PMS`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1a2744;">
            <div style="margin-bottom: 32px;">
              <span style="font-size: 20px; font-weight: 700; color: #1a2744;">Integrio PMS</span>
            </div>
            <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 12px;">You've been invited</h2>
            <p style="color: #8896a5; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
              <strong style="color: #1a2744;">${ownerName}</strong> has added you to their Integrio PMS workspace as a <strong style="color: #1a2744;">${role}</strong>.
            </p>
            <p style="color: #8896a5; font-size: 14px; margin-bottom: 16px;">Use these credentials to sign in:</p>
            <div style="background: #f0f4f8; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px;">
              <div style="margin-bottom: 16px;">
                <div style="font-size: 11px; font-weight: 600; color: #8896a5; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Email</div>
                <div style="font-size: 15px; color: #1a2744; font-weight: 600;">${email}</div>
              </div>
              <div>
                <div style="font-size: 11px; font-weight: 600; color: #8896a5; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Temporary password</div>
                <div style="font-size: 22px; color: #1a2744; font-weight: 700; letter-spacing: 0.12em; font-family: monospace; background: white; padding: 10px 16px; border-radius: 8px; border: 1.5px solid #e8edf3;">${tempPassword}</div>
              </div>
            </div>
            <a href="${appUrl}/login" style="display: inline-block; background: linear-gradient(135deg, #1a2744, #2cb5b0); color: white; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-size: 14px; font-weight: 600;">
              Sign in to Integrio →
            </a>
            <p style="color: #8896a5; font-size: 12px; margin-top: 32px; line-height: 1.6;">
              Please change your password after your first login.<br/>
              If you weren't expecting this invite, you can ignore this email.
            </p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Gmail SMTP error:", emailErr);
      return NextResponse.json({
        ok: true,
        warning: `User created but email failed. Temp password: ${tempPassword}`,
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
