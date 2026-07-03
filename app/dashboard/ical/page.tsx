"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Property {
  id: string;
  name: string;
  airbnbIcalUrl: string | null;
  ourIcalToken: string;
  autoSyncEnabled: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSync: { fetchedAt: string; userAgent: string } | null;
}

export default function IcalPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties() {
    setLoading(true);
    const { data } = await supabase
      .from("Property")
      .select(
        "id, name, airbnbIcalUrl, ourIcalToken, autoSyncEnabled, lastSyncedAt, lastSyncStatus"
      );

    if (data) {
      const withSync = await Promise.all(
        data.map(async (p) => {
          const { data: log } = await supabase
            .from("IcalFetchLog")
            .select("fetchedAt, userAgent")
            .eq("propertyId", p.id)
            .order("fetchedAt", { ascending: false })
            .limit(1)
            .single();

          return { ...p, lastSync: log ?? null };
        })
      );
      setProperties(withSync);
    }
    setLoading(false);
  }

  async function syncAirbnb(property: Property) {
    if (!property.airbnbIcalUrl) return;
    setSyncing(property.id);
    setResults((r) => ({ ...r, [property.id]: "Syncing..." }));

    try {
      const res = await fetch("/api/sync-ical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          airbnbIcalUrl: property.airbnbIcalUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResults((r) => ({ ...r, [property.id]: `❌ ${data.error}` }));
        return;
      }

      setResults((r) => ({
        ...r,
        [property.id]: `✅ Done! ${data.imported} new booking${
          data.imported !== 1 ? "s" : ""
        } imported, ${data.skipped} already existed.`,
      }));

      // refresh so lastSyncedAt reflects the sync we just triggered
      loadProperties();
    } catch (err) {
      setResults((r) => ({
        ...r,
        [property.id]: `❌ Sync failed: ${String(err)}`,
      }));
    }

    setSyncing(null);
  }

  function copyOurLink(token: string, id: string) {
    const url = `${window.location.origin}/api/ical/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--brand-text)",
            marginBottom: 4,
          }}
        >
          iCal Sync
        </h1>
        <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
          Import from Airbnb and export your availability to Airbnb
        </p>
      </div>

      {/* How it works */}
      <div
        style={{
          background: "linear-gradient(135deg, #1a2744, #243660)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 28,
          color: "white",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          📡 How iCal Sync Works
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              icon: "⬇️",
              title: "Import from Airbnb",
              desc: "Paste your Airbnb iCal URL in the property settings, then click Sync to import bookings — or turn on Auto-Sync in Settings to have it run automatically.",
            },
            {
              icon: "⬆️",
              title: "Export to Airbnb",
              desc: "Copy your Integrio iCal link and paste it in Airbnb → Calendar → Sync → Import Calendar.",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                {item.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.5,
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--brand-text-muted)",
          }}
        >
          Loading properties...
        </div>
      ) : properties.length === 0 ? (
        <div
          style={{
            background: "var(--popover)",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
          <h3 style={{ color: "#1a2744", marginBottom: 8 }}>
            No properties yet
          </h3>
          <a
            href="/dashboard/properties"
            style={{ color: "#2cb5b0", fontWeight: 600, fontSize: 14 }}
          >
            Add a property first →
          </a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {properties.map((p) => (
            <div
              key={p.id}
              style={{
                background: "var(--popover)",
                borderRadius: 16,
                padding: 28,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
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
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--brand-text)",
                  }}
                >
                  🏠 {p.name}
                </h3>
                {p.autoSyncEnabled && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#155724",
                      background: "#d4edda",
                      borderRadius: 20,
                      padding: "4px 10px",
                    }}
                  >
                    🔁 Auto-Sync ON
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                }}
              >
                {/* Import */}
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 10,
                    }}
                  >
                    ⬇️ Import from Airbnb
                  </div>
                  {p.airbnbIcalUrl ? (
                    <>
                      <div
                        style={{
                          background: "var(--popover)",
                          borderRadius: 8,
                          padding: "10px 14px",
                          fontSize: 12,
                          fontFamily: "monospace",
                          color: "var(--brand-text)",
                          wordBreak: "break-all",
                          marginBottom: 12,
                          border: "2px solid var(--border)",
                        }}
                      >
                        {p.airbnbIcalUrl}
                      </div>

                      {p.autoSyncEnabled ? (
                        <>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#27ae60",
                              marginBottom: 8,
                            }}
                          >
                            {p.lastSyncedAt ? (
                              <>
                                🟢 Auto-synced{" "}
                                {new Date(p.lastSyncedAt).toLocaleString(
                                  "en-PH"
                                )}
                                {p.lastSyncStatus === "error" &&
                                  " (last attempt failed, will retry)"}
                              </>
                            ) : (
                              "🟡 Auto-sync enabled — waiting for first run"
                            )}
                          </div>
                          <button
                            onClick={() => syncAirbnb(p)}
                            disabled={syncing === p.id}
                            style={{
                              background: "transparent",
                              color: "#2cb5b0",
                              border: "1.5px solid #2cb5b0",
                              borderRadius: 10,
                              padding: "8px 16px",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              opacity: syncing === p.id ? 0.7 : 1,
                            }}
                          >
                            {syncing === p.id
                              ? "⏳ Syncing..."
                              : "↻ Sync now anyway"}
                          </button>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--brand-text-muted)",
                              marginTop: 8,
                            }}
                          >
                            Manage this in{" "}
                            <a
                              href="/settings"
                              style={{ color: "#2cb5b0", fontWeight: 600 }}
                            >
                              Settings →
                            </a>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => syncAirbnb(p)}
                          disabled={syncing === p.id}
                          style={{
                            background:
                              "linear-gradient(135deg, #1a2744, #2cb5b0)",
                            color: "white",
                            border: "none",
                            borderRadius: 10,
                            padding: "10px 20px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity: syncing === p.id ? 0.7 : 1,
                          }}
                        >
                          {syncing === p.id ? "⏳ Syncing..." : "↻ Sync Now"}
                        </button>
                      )}

                      {results[p.id] && (
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 13,
                            color: results[p.id].includes("✅")
                              ? "#27ae60"
                              : "#e74c3c",
                          }}
                        >
                          {results[p.id]}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: "#aab4be" }}>
                      No Airbnb iCal URL set.{" "}
                      <a
                        href="/dashboard/properties"
                        style={{ color: "#2cb5b0", fontWeight: 600 }}
                      >
                        Edit property →
                      </a>
                    </div>
                  )}
                </div>

                {/* Export */}
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--brand-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 10,
                    }}
                  >
                    ⬆️ Export to Airbnb
                  </div>
                  <div
                    style={{
                      background: "var(--popover)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "var(--brand-text)",
                      wordBreak: "break-all",
                      marginBottom: 12,
                      border: "2px solid var(--border)",
                    }}
                  >
                    {window.location.origin}/api/ical/{p.ourIcalToken}
                  </div>
                  <button
                    onClick={() => copyOurLink(p.ourIcalToken, p.id)}
                    style={{
                      background: copiedId === p.id ? "#27ae60" : "#f0f4f8",
                      color: copiedId === p.id ? "white" : "#1a2744",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {copiedId === p.id ? "✓ Copied!" : "📋 Copy Link"}
                  </button>{" "}
                  <div style={{ fontSize: 13, marginTop: 8 }}>
                    {p.lastSync ? (
                      <span style={{ color: "#27ae60" }}>
                        🟢 Last fetched{" "}
                        {new Date(p.lastSync.fetchedAt).toLocaleString("en-PH")}
                        {p.lastSync.userAgent
                          ?.toLowerCase()
                          .includes("airbnb") && " by Airbnb"}
                      </span>
                    ) : (
                      <span style={{ color: "#8896a5" }}>⚪ Never fetched</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
