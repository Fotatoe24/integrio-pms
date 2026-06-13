"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Login";
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Fetch user from Supabase directly (client-side)
      const { data: user, error: fetchError } = await supabase
        .from("User")
        .select("*")
        .eq("email", email.toLowerCase())
        .single();

      if (fetchError || !user) {
        setError("Invalid credentials");
        setLoading(false);
        return;
      }

      // Verify password client-side
      const bcrypt = await import("bcryptjs");
      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        setError("Invalid credentials");
        setLoading(false);
        return;
      }

      // After verifying password is valid, add this before router.push:
      document.cookie = `auth-token=loggedin; path=/; max-age=${
        60 * 60 * 24 * 7
      }`;

      localStorage.setItem(
        "integrio_user",
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          owner_id: user.owner_id ?? null,
        })
      );

      const roleRoutes: Record<string, string> = {
        owner: "/owner",
        booker: "/dashboard",
        auditor: "/auditor",
        housekeeping: "/housekeeping",
        ADMIN: "/owner",
        STAFF: "/dashboard",
      };

      const destination = roleRoutes[user.role] ?? "/dashboard";
      window.location.href = destination;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      <div className="login-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="grid-lines" />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect
                x="2"
                y="2"
                width="10"
                height="10"
                rx="2"
                fill="currentColor"
                opacity="0.9"
              />
              <rect
                x="16"
                y="2"
                width="10"
                height="10"
                rx="2"
                fill="currentColor"
                opacity="0.5"
              />
              <rect
                x="2"
                y="16"
                width="10"
                height="10"
                rx="2"
                fill="currentColor"
                opacity="0.5"
              />
              <rect
                x="16"
                y="16"
                width="10"
                height="10"
                rx="2"
                fill="currentColor"
                opacity="0.9"
              />
            </svg>
          </div>
          <span className="brand-name">Integrio</span>
        </div>

        <div className="login-header">
          <h1>Welcome back</h1>
          <p>Sign in to your property dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            <div style={{ textAlign: "right", marginTop: -12 }}>
              <a
                href="/forgot-password"
                style={{
                  fontSize: 13,
                  color: "#4ecdc4",
                  textDecoration: "none",
                  fontFamily: "-apple-system, sans-serif",
                }}
              >
                Forgot password?
              </a>
            </div>
          </div>

          {error && (
            <div className="error-msg">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8"
                  cy="8"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 5v3M8 11v.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign in"}
          </button>

          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "rgba(240,236,228,0.4)",
              fontFamily: "-apple-system, sans-serif",
              marginTop: 8,
            }}
          >
            Don't have an account?{" "}
            <a
              href="/signup"
              style={{ color: "#4ecdc4", textDecoration: "none" }}
            >
              Sign up
            </a>
          </p>
        </form>

        <p className="login-footer">
          Integrio PMS &copy; {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0c0e12;
          font-family: 'Georgia', serif;
          position: relative;
          overflow: hidden;
        }
        .login-bg { position: absolute; inset: 0; pointer-events: none; }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
        }
        .orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #c9a84c, transparent 70%);
          top: -120px; left: -100px;
          animation: drift 12s ease-in-out infinite alternate;
        }
        .orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #4c7ac9, transparent 70%);
          bottom: -100px; right: -80px;
          animation: drift 15s ease-in-out infinite alternate-reverse;
        }
        .grid-lines {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        @keyframes drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(40px, 30px) scale(1.1); }
        }
        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          margin: 24px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 44px 40px 36px;
          backdrop-filter: blur(24px);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
          animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 36px;
          color: #c9a84c;
        }
        .brand-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
        .brand-name {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #c9a84c;
        }
        .login-header { margin-bottom: 32px; }
        .login-header h1 {
          font-size: 28px;
          font-weight: 400;
          color: #f0ece4;
          letter-spacing: -0.02em;
          margin-bottom: 6px;
        }
        .login-header p {
          font-size: 14px;
          color: rgba(240,236,228,0.45);
          font-family: -apple-system, sans-serif;
        }
        .login-form { display: flex; flex-direction: column; gap: 20px; }
        .field { display: flex; flex-direction: column; gap: 8px; }
        .field label {
          font-size: 12px;
          font-family: -apple-system, sans-serif;
          color: rgba(240,236,228,0.5);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 500;
        }
        .field input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 13px 16px;
          color: #f0ece4;
          font-size: 15px;
          font-family: -apple-system, sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          width: 100%;
        }
        .field input::placeholder { color: rgba(240,236,228,0.2); }
        .field input:focus {
          border-color: rgba(201,168,76,0.6);
          background: rgba(201,168,76,0.05);
          box-shadow: 0 0 0 3px rgba(201,168,76,0.08);
        }
        .error-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-family: -apple-system, sans-serif;
          color: #e07070;
          background: rgba(224,112,112,0.08);
          border: 1px solid rgba(224,112,112,0.2);
          border-radius: 8px;
          padding: 10px 14px;
          animation: shake 0.3s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .login-btn {
          margin-top: 4px;
          background: linear-gradient(135deg, #c9a84c 0%, #e8c96a 50%, #c9a84c 100%);
          border: none;
          border-radius: 10px;
          padding: 14px;
          color: #1a1508;
          font-size: 15px;
          font-weight: 600;
          font-family: -apple-system, sans-serif;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 24px rgba(201,168,76,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          height: 48px;
          width: 100%;
        }
        .login-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(201,168,76,0.35);
        }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(26,21,8,0.3);
          border-top-color: #1a1508;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-footer {
          margin-top: 28px;
          text-align: center;
          font-size: 12px;
          font-family: -apple-system, sans-serif;
          color: rgba(240,236,228,0.2);
        }
      `}</style>
    </div>
  );
}
