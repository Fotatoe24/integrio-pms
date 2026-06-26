"use client";

import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      const bcrypt = await import("bcryptjs");
      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        setError("Invalid credentials");
        setLoading(false);
        return;
      }

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
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10"
      style={{
        background:
          "linear-gradient(160deg, #1e3a5f 0%, #2f5d8c 45%, #4a90e2 100%)",
      }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-4 select-none">
        <img
          src="/darktrans.png"
          alt="Integrio"
          className="w-[260px] sm:w-[300px] h-auto"
          style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}
        />
      </div>

      {/* Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl px-8 sm:px-9 py-9">
        <h1 className="text-2xl sm:text-[26px] font-bold text-center text-[#1e3a5f] mb-7">
          Login
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm text-gray-700 mb-1.5"
            >
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 pl-4 pr-11 py-3 text-[15px] text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-[#4a90e2] focus:ring-2 focus:ring-[#4a90e2]/20"
              />
              <svg
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm text-gray-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 pl-4 pr-11 py-3 text-[15px] text-gray-800 placeholder-gray-400 outline-none transition-colors focus:border-[#4a90e2] focus:ring-2 focus:ring-[#4a90e2]/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 grid place-items-center w-6 h-6 rounded"
              >
                {showPassword ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                    <path d="M9.5 5.2A10.4 10.4 0 0112 5c5 0 9 4 10 7-0.4 1.2-1.2 2.6-2.4 3.9M6.1 6.6C4 8 2.5 10 2 12c1 3 5 7 10 7 1.1 0 2.1-0.2 3-0.5" />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <div className="text-right mt-1.5">
              <a
                href="/forgot-password"
                className="text-xs text-[#4a90e2] hover:underline"
              >
                Forgot password?
              </a>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1e3a5f] hover:bg-[#264c79] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-base rounded-lg py-3.5 mt-2 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Login"
            )}
          </button>

          <p className="text-center text-sm text-gray-700 mt-1">
            Don&apos;t have an account?{" "}
            <a
              href="/signup"
              className="text-[#4a90e2] font-semibold hover:underline"
            >
              Sign Up
            </a>
          </p>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-white/60">
        Integrio PMS &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
