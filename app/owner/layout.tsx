"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OwnerDataProvider, useOwnerData } from "./OwnerDataContext";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/redflags", label: "Redflags" },
  { href: "/owner/checklist", label: "Checklist" },
  { href: "/owner/employees", label: "Employees" },
  { href: "/owner/receivers", label: "Receivers" },
  { href: "/owner/expenses", label: "Expenses" },
  { href: "/owner/payments", label: "Payments" },
  { href: "/owner/bookings", label: "Bookings" },
  { href: "/owner/calendar", label: "Calendar" },
];

function OwnerChrome({ children }: { children: React.ReactNode }) {
  const { user, loading, theme, toggleTheme, flags, flagsLoading, logout } = useOwnerData();
  const pathname = usePathname();
  const router = useRouter();

  const dangerFlags = flags.filter((f) => f.severity === "danger").length;

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--brand-bg)",
        fontFamily: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "var(--brand-text)",
        transition: "background-color .2s, color .2s",
      }}
    >
      {/* Header */}
      <div className="nav-in-owner">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/blacklogo.png"
            alt="Integrio"
            className="w-20 sm:w-20 h-auto block dark:hidden"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}
          />
          <img
            src="/darktrans.png"
            alt="Integrio"
            className="w-20 sm:w-20 h-auto hidden dark:block"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}
          />

          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              background: "var(--brand-surface)",
              color: "var(--brand-text-muted)",
              border: "1px solid var(--brand-border)",
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            Owner
          </span>

          {!flagsLoading && flags.length > 0 && (
            <button
              onClick={() => router.push("/owner/redflags")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                background: dangerFlags > 0 ? "rgba(255,56,92,.14)" : "rgba(200,125,0,.15)",
                color: dangerFlags > 0 ? "var(--rausch)" : "var(--amber)",
                border: "none",
                borderRadius: 999,
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              🚩 {flags.length} flag{flags.length === 1 ? "" : "s"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--brand-text)", marginRight: 4 }}>{user.name}</span>

          <button
            onClick={toggleTheme}
            className="icon-btn-owner theme-toggle"
            aria-label="Toggle day or dark view"
            title="Toggle day / dark view"
          >
            {theme === "dark" ? (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>

          <a href="/settings" className="btn-owner">
            Settings
          </a>
          <button onClick={logout} className="btn-owner ghost-owner">
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-.02em",
              color: "var(--brand-text)",
              marginBottom: 4,
            }}
          >
            Owner Dashboard
          </h1>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 15 }}>
            Full visibility across all operations
          </p>
        </div>

        {/* Nav tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/owner" ? pathname === "/owner" : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: "none",
                  background: active ? "rgba(255,56,92,.12)" : "transparent",
                  color: active ? "var(--rausch)" : "var(--brand-text-muted)",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "background .15s, color .15s",
                }}
              >
                {item.label}
                {item.label === "Redflags" && flags.length > 0 && (
                  <span
                    style={{
                      background: "var(--rausch)",
                      color: "white",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                      minWidth: 16,
                      textAlign: "center",
                    }}
                  >
                    {flags.length}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "var(--brand-text-muted)" }}>
            Loading...
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerDataProvider>
      <OwnerChrome>{children}</OwnerChrome>
    </OwnerDataProvider>
  );
}
