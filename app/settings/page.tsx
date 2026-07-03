"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, IntegrioUser } from "@/lib/auth";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";

const ROLE_HOME: Record<string, string> = {
  owner: "/owner",
  booker: "/dashboard",
  auditor: "/auditor",
  housekeeping: "/housekeeping",
  ADMIN: "/owner",
  STAFF: "/dashboard",
};

const ROLE_BADGE: Record<string, { bg: string; color: string; label: string }> =
  {
    owner: { bg: "#e8d5f5", color: "#5a2d82", label: "Owner" },
    booker: { bg: "#d1ecf1", color: "#0c5460", label: "Booker" },
    auditor: { bg: "#fff3cd", color: "#856404", label: "Auditor" },
    housekeeping: { bg: "#d4edda", color: "#155724", label: "Housekeeping" },
    ADMIN: { bg: "#e8d5f5", color: "#5a2d82", label: "Owner" },
    STAFF: { bg: "#d1ecf1", color: "#0c5460", label: "Booker" },
  };

const THEME_OPTIONS: {
  value: "light" | "dark" | "system";
  label: string;
  icon: string;
  desc: string;
}[] = [
  { value: "light", label: "Light", icon: "☀️", desc: "Always use light mode" },
  { value: "dark", label: "Dark", icon: "🌙", desc: "Always use dark mode" },
  {
    value: "system",
    label: "System",
    icon: "🖥️",
    desc: "Match your device settings",
  },
];

interface IcalProperty {
  id: string;
  name: string;
  airbnbIcalUrl: string | null;
  autoSyncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<IntegrioUser | null>(null);
  const [saved, setSaved] = useState(false);

  const [icalProperties, setIcalProperties] = useState<IcalProperty[]>([]);
  const [icalLoading, setIcalLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Settings — Integrio";
    const u = getCurrentUser();
    if (!u) {
      router.push("/login");
      return;
    }
    setUser(u);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "owner" && user.role !== "ADMIN") {
      setIcalLoading(false);
      return;
    }
    loadIcalProperties();
  }, [user]);

  async function loadIcalProperties() {
    setIcalLoading(true);
    const { data } = await supabase
      .from("Property")
      .select(
        "id, name, airbnbIcalUrl, autoSyncEnabled, lastSyncedAt, lastSyncStatus"
      )
      .order("name");

    setIcalProperties(data || []);
    setIcalLoading(false);
  }

  async function toggleAutoSync(propertyId: string, current: boolean) {
    setTogglingId(propertyId);

    // optimistic update
    setIcalProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId ? { ...p, autoSyncEnabled: !current } : p
      )
    );

    const { error } = await supabase
      .from("Property")
      .update({ autoSyncEnabled: !current })
      .eq("id", propertyId);

    if (error) {
      // revert on failure
      setIcalProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId ? { ...p, autoSyncEnabled: current } : p
        )
      );
    }

    setTogglingId(null);
  }

  async function handleThemeChange(value: "light" | "dark" | "system") {
    await setTheme(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!user) return null;

  const badge = ROLE_BADGE[user.role] || ROLE_BADGE.booker;
  const canManageSync = user.role === "owner" || user.role === "ADMIN";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--brand-bg, #f0f4f8)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--brand-surface, white)",
          borderBottom: "1px solid var(--brand-border, #e8edf3)",
          padding: "0 32px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Logo — swaps with theme via Tailwind's dark: variant */}
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
              fontWeight: 600,
              background: badge.bg,
              color: badge.color,
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            {badge.label}
          </span>
        </div>

        <a
          href={ROLE_HOME[user.role] || "/dashboard"}
          style={{
            fontSize: 13,
            color: "var(--brand-text-muted, #8896a5)",
            border: "1.5px solid var(--brand-border, #e8edf3)",
            borderRadius: 8,
            padding: "6px 14px",
            textDecoration: "none",
          }}
        >
          ← Back to dashboard
        </a>
      </div>

      <div
        style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}
      >
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--brand-text, #1a2744)",
              marginBottom: 4,
            }}
          >
            Settings
          </h1>
          <p
            style={{ color: "var(--brand-text-muted, #8896a5)", fontSize: 14 }}
          >
            Manage your account preferences
          </p>
        </div>

        {/* Appearance section */}
        <div
          style={{
            background: "var(--brand-surface, white)",
            borderRadius: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            padding: "28px 28px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--brand-text, #1a2744)",
                  marginBottom: 4,
                }}
              >
                Appearance
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--brand-text-muted, #8896a5)",
                }}
              >
                Choose how Integrio looks on this and all your devices
              </p>
            </div>
            {saved && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#155724",
                  background: "#d4edda",
                  borderRadius: 20,
                  padding: "4px 12px",
                }}
              >
                ✓ Saved
              </span>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleThemeChange(opt.value)}
                style={{
                  padding: "20px 16px",
                  borderRadius: 12,
                  border:
                    theme === opt.value
                      ? "2px solid #2cb5b0"
                      : "1.5px solid var(--brand-border, #e8edf3)",
                  background:
                    theme === opt.value
                      ? "rgba(44,181,176,0.08)"
                      : "var(--brand-surface, white)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 28 }}>{opt.icon}</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--brand-text, #1a2744)",
                  }}
                >
                  {opt.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--brand-text-muted, #8896a5)",
                    textAlign: "center",
                  }}
                >
                  {opt.desc}
                </span>
                {theme === opt.value && (
                  <span
                    style={{ fontSize: 11, fontWeight: 600, color: "#2cb5b0" }}
                  >
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* iCal Auto-Sync section — owner/ADMIN only */}
        {canManageSync && (
          <div
            style={{
              background: "var(--brand-surface, white)",
              borderRadius: 16,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              padding: "28px 28px",
              marginBottom: 20,
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--brand-text, #1a2744)",
                  marginBottom: 4,
                }}
              >
                iCal Auto-Sync
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--brand-text-muted, #8896a5)",
                }}
              >
                Automatically pull bookings from Airbnb every few hours instead
                of syncing manually from the iCal page
              </p>
            </div>

            {icalLoading ? (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--brand-text-muted, #8896a5)",
                }}
              >
                Loading properties…
              </p>
            ) : icalProperties.length === 0 ? (
              <p
                style={{
                  fontSize: 13,
                  color: "var(--brand-text-muted, #8896a5)",
                }}
              >
                No properties found.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {icalProperties.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: 16,
                      borderBottom:
                        i < icalProperties.length - 1
                          ? "1px solid var(--brand-border, #e8edf3)"
                          : "none",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--brand-text, #1a2744)",
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--brand-text-muted, #8896a5)",
                          marginTop: 2,
                        }}
                      >
                        {!p.airbnbIcalUrl
                          ? "No Airbnb iCal URL set — add one on the iCal page"
                          : p.lastSyncedAt
                          ? `Last synced ${new Date(
                              p.lastSyncedAt
                            ).toLocaleString("en-PH")}${
                              p.lastSyncStatus === "error"
                                ? " — last attempt failed"
                                : ""
                            }`
                          : "Never synced yet"}
                      </div>
                    </div>

                    <button
                      disabled={!p.airbnbIcalUrl || togglingId === p.id}
                      onClick={() => toggleAutoSync(p.id, p.autoSyncEnabled)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 999,
                        border: "none",
                        background: p.autoSyncEnabled
                          ? "#2cb5b0"
                          : "var(--brand-border, #e8edf3)",
                        position: "relative",
                        cursor: !p.airbnbIcalUrl ? "not-allowed" : "pointer",
                        opacity: !p.airbnbIcalUrl
                          ? 0.5
                          : togglingId === p.id
                          ? 0.6
                          : 1,
                        transition: "background 0.15s",
                        flexShrink: 0,
                      }}
                      aria-label={`Toggle auto-sync for ${p.name}`}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 3,
                          left: p.autoSyncEnabled ? 23 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "white",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          transition: "left 0.15s",
                        }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Account info section */}
        <div
          style={{
            background: "var(--brand-surface, white)",
            borderRadius: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            padding: "28px 28px",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--brand-text, #1a2744)",
              marginBottom: 20,
            }}
          >
            Account
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--brand-text-muted, #8896a5)",
                }}
              >
                Name
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--brand-text, #1a2744)",
                }}
              >
                {user.name}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--brand-text-muted, #8896a5)",
                }}
              >
                Email
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--brand-text, #1a2744)",
                }}
              >
                {user.email}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--brand-text-muted, #8896a5)",
                }}
              >
                Role
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: badge.bg,
                  color: badge.color,
                  borderRadius: 20,
                  padding: "3px 10px",
                }}
              >
                {badge.label}
              </span>
            </div>
            <div
              style={{
                paddingTop: 8,
                borderTop: "1px solid var(--brand-border, #e8edf3)",
              }}
            >
              <a
                href="/change-password"
                style={{
                  display: "inline-block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#2cb5b0",
                  textDecoration: "none",
                  marginTop: 12,
                }}
              >
                Change password →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
