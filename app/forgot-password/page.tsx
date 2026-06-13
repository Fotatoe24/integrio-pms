"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus("error");
      setMessage(json.error || "Something went wrong.");
      return;
    }

    setStatus("success");
    setMessage(`Password reset link sent to ${email}. Check your inbox!`);
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
          <img
            src="/darktrans.png"
            alt="Integrio"
            style={{ width: 120, objectFit: "contain" }}
          />
        </div>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
            <h2
              style={{
                fontSize: 22,
                color: "#f0ece4",
                marginBottom: 10,
                fontWeight: 400,
              }}
            >
              Check your email
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "rgba(240,236,228,0.5)",
                lineHeight: 1.6,
                fontFamily: "-apple-system, sans-serif",
              }}
            >
              {message}
            </p>
            <a
              href="/login"
              style={{
                display: "inline-block",
                marginTop: 24,
                color: "#4ecdc4",
                fontSize: 14,
                textDecoration: "none",
                fontFamily: "-apple-system, sans-serif",
              }}
            >
              ← Back to Login
            </a>
          </div>
        ) : (
          <>
            <div className="login-header">
              <h1>Forgot password?</h1>
              <p>Enter your email and we'll send you a reset link</p>
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

              {status === "error" && (
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
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="login-btn"
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <span className="spinner" />
                ) : (
                  "Send Reset Link"
                )}
              </button>

              <p
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: "rgba(240,236,228,0.4)",
                  fontFamily: "-apple-system, sans-serif",
                }}
              >
                Remember your password?{" "}
                <a
                  href="/login"
                  style={{ color: "#4ecdc4", textDecoration: "none" }}
                >
                  Sign in
                </a>
              </p>
            </form>
          </>
        )}
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .login-root {
          min-height: 100vh; display: flex; align-items: center;
          justify-content: center; background: #0c0e12;
          font-family: 'Georgia', serif; position: relative; overflow: hidden;
        }
        .login-bg { position: absolute; inset: 0; pointer-events: none; }
        .orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.18; }
        .orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #1a2744, transparent 70%);
          top: -120px; left: -100px;
          animation: drift 12s ease-in-out infinite alternate;
        }
        .orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #4ecdc4, transparent 70%);
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
          from { transform: translate(0,0) scale(1); }
          to { transform: translate(40px,30px) scale(1.1); }
        }
        .login-card {
          position: relative; z-index: 10; width: 100%; max-width: 420px;
          margin: 24px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 20px;
          padding: 44px 40px 36px; backdrop-filter: blur(24px);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08);
          animation: cardIn 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .login-brand { margin-bottom: 32px; }
        .login-header { margin-bottom: 28px; }
        .login-header h1 { font-size: 26px; font-weight: 400; color: #f0ece4; letter-spacing: -0.02em; margin-bottom: 6px; }
        .login-header p { font-size: 14px; color: rgba(240,236,228,0.45); font-family: -apple-system, sans-serif; }
        .login-form { display: flex; flex-direction: column; gap: 20px; }
        .field { display: flex; flex-direction: column; gap: 8px; }
        .field label { font-size: 12px; font-family: -apple-system, sans-serif; color: rgba(240,236,228,0.5); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500; }
        .field input {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 13px 16px; color: #f0ece4; font-size: 15px;
          font-family: -apple-system, sans-serif; outline: none; width: 100%;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field input::placeholder { color: rgba(240,236,228,0.2); }
        .field input:focus { border-color: rgba(78,205,196,0.6); box-shadow: 0 0 0 3px rgba(78,205,196,0.08); }
        .error-msg {
          display: flex; align-items: center; gap: 8px; font-size: 13px;
          font-family: -apple-system, sans-serif; color: #e07070;
          background: rgba(224,112,112,0.08); border: 1px solid rgba(224,112,112,0.2);
          border-radius: 8px; padding: 10px 14px;
        }
        .login-btn {
          background: linear-gradient(135deg, #1a2744 0%, #2cb5b0 100%);
          border: none; border-radius: 10px; padding: 14px; color: white;
          font-size: 15px; font-weight: 600; font-family: -apple-system, sans-serif;
          cursor: pointer; height: 48px; width: 100%;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 24px rgba(44,181,176,0.25);
        }
        .login-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
