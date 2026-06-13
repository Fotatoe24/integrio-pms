"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    document.title = "Change Password — Integrio";
    const u = getCurrentUser();
    if (!u) router.push("/login");
  }, []);

  async function handleSubmit() {
    setError("");
    setSuccess("");

    if (newPass.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPass !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const user = getCurrentUser();
    if (!user) return;

    // Verify current password first
    const bcrypt = await import("bcryptjs");
    const { data: dbUser } = await supabase
      .from("User")
      .select("password")
      .eq("id", user.id)
      .single();

    if (!dbUser) {
      setError("User not found.");
      setLoading(false);
      return;
    }

    const isValid = await bcrypt.compare(current, dbUser.password);
    if (!isValid) {
      setError("Current password is incorrect.");
      setLoading(false);
      return;
    }

    // Hash and save new password
    const hashed = await bcrypt.hash(newPass, 12);
    const { error: updateError } = await supabase
      .from("User")
      .update({
        password: hashed,
        temp_password: null,
        status: "active",
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess("Password changed successfully!");
    setCurrent("");
    setNewPass("");
    setConfirm("");
    setLoading(false);

    // Redirect back to their page after 2 seconds
    setTimeout(() => {
      const roleRoutes: Record<string, string> = {
        owner: "/owner",
        booker: "/dashboard",
        auditor: "/auditor",
        housekeeping: "/housekeeping",
        ADMIN: "/owner",
        STAFF: "/dashboard",
      };
      router.push(roleRoutes[user.role] ?? "/dashboard");
    }, 2000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #e8edf3",
    borderRadius: 10,
    fontSize: 14,
    color: "#1a2744",
    outline: "none",
    fontFamily: "inherit",
    background: "white",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#8896a5",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f4f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, margin: "24px" }}>
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 32,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect
                x="2"
                y="2"
                width="10"
                height="10"
                rx="2"
                fill="white"
                opacity="0.9"
              />
              <rect
                x="16"
                y="2"
                width="10"
                height="10"
                rx="2"
                fill="white"
                opacity="0.5"
              />
              <rect
                x="2"
                y="16"
                width="10"
                height="10"
                rx="2"
                fill="white"
                opacity="0.5"
              />
              <rect
                x="16"
                y="16"
                width="10"
                height="10"
                rx="2"
                fill="white"
                opacity="0.9"
              />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#1a2744" }}>
            Integrio
          </span>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 20,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            padding: "36px 40px",
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#1a2744",
              marginBottom: 8,
            }}
          >
            Change password
          </h1>
          <p style={{ fontSize: 14, color: "#8896a5", marginBottom: 28 }}>
            Set a new password for your account.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Current password</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Your temp or current password"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2cb5b0")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e8edf3")}
              />
            </div>
            <div>
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="At least 8 characters"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2cb5b0")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e8edf3")}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#2cb5b0")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e8edf3")}
              />
            </div>

            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#e74c3c",
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                style={{
                  background: "#d4edda",
                  border: "1px solid #c3e6cb",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#155724",
                }}
              >
                ✓ {success}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !current || !newPass || !confirm}
              style={{
                marginTop: 8,
                padding: "13px",
                background:
                  loading || !current || !newPass || !confirm
                    ? "#e8edf3"
                    : "linear-gradient(135deg, #1a2744, #2cb5b0)",
                border: "none",
                borderRadius: 10,
                color:
                  loading || !current || !newPass || !confirm
                    ? "#8896a5"
                    : "white",
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  loading || !current || !newPass || !confirm
                    ? "not-allowed"
                    : "pointer",
                boxShadow:
                  loading || !current || !newPass || !confirm
                    ? "none"
                    : "0 4px 16px rgba(44,181,176,0.3)",
                transition: "all 0.2s",
              }}
            >
              {loading ? "Saving..." : "Change password"}
            </button>
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "#8896a5",
            marginTop: 24,
          }}
        >
          Integrio PMS © {new Date().getFullYear()}
        </p>
      </div>

      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
    </div>
  );
}
