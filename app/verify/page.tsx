"use client";

import { useEffect, useState } from "react";

export default function VerifyPage() {
  const [status, setStatus] = useState("Verifying your email...");

  useEffect(() => {
    document.title = "Verify Email";
  }, []);

  useEffect(() => {
    // Supabase redirects here after email verification
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      setStatus("Email verified! Redirecting to login...");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } else {
      setStatus("Email verified! You can now log in.");
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0c0e12",
        color: "#f0ece4",
        fontFamily: "Georgia, serif",
        flexDirection: "column",
        gap: 16,
        textAlign: "center",
        padding: 24,
      }}
    >
      <img
        src="/darktrans.png"
        alt="Integrio"
        style={{ width: 140, marginBottom: 16 }}
      />
      <h1 style={{ fontSize: 24, fontWeight: 400 }}>✅ {status}</h1>
      <a href="/login" style={{ color: "#4ecdc4", fontSize: 14, marginTop: 8 }}>
        Go to Login →
      </a>
    </div>
  );
}
