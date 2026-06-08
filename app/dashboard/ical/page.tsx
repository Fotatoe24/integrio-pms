"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Property {
  id: string;
  name: string;
  airbnbIcalUrl: string | null;
  ourIcalToken: string;
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
      .select("id, name, airbnbIcalUrl, ourIcalToken");
    if (data) setProperties(data);
    setLoading(false);
  }

  async function syncAirbnb(property: Property) {
    if (!property.airbnbIcalUrl) return;
    setSyncing(property.id);
    setResults((r) => ({ ...r, [property.id]: "Syncing..." }));

    try {
      const res = await fetch(property.airbnbIcalUrl);
      const icsText = await res.text();

      // Parse VEVENT blocks
      const events = icsText.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
      let imported = 0;

      for (const event of events) {
        const uid = event.match(/UID:(.*)/)?.[1]?.trim();
        const dtstart = event.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim();
        const dtend = event.match(/DTEND[^:]*:(.*)/)?.[1]?.trim();
        const summary =
          event.match(/SUMMARY:(.*)/)?.[1]?.trim() || "Airbnb Guest";

        if (!uid || !dtstart || !dtend) continue;

        // Check if already exists
        const { data: existing } = await supabase
          .from("Booking")
          .select("id")
          .eq("externalUid", uid)
          .single();

        if (existing) continue;

        // Parse dates
        const parseDate = (d: string) => {
          const clean = d.replace(/T\d{6}Z?$/, "");
          return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(
            6,
            8
          )}`;
        };

        await supabase.from("Booking").insert({
          propertyId: property.id,
          guestName: summary.includes("Reserved") ? "Airbnb Reserved" : summary,
          checkIn: new Date(parseDate(dtstart)).toISOString(),
          checkOut: new Date(parseDate(dtend)).toISOString(),
          status: "CONFIRMED",
          source: "AIRBNB",
          externalUid: uid,
          guestCount: 1,
        });
        imported++;
      }

      setResults((r) => ({
        ...r,
        [property.id]: `✅ Synced! ${imported} new booking${
          imported !== 1 ? "s" : ""
        } imported.`,
      }));
    } catch {
      setResults((r) => ({
        ...r,
        [property.id]: "❌ Sync failed. Check the iCal URL.",
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
            color: "#1a2744",
            marginBottom: 4,
          }}
        >
          iCal Sync
        </h1>
        <p style={{ color: "#8896a5", fontSize: 14 }}>
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
              desc: "Paste your Airbnb iCal URL in the property settings, then click Sync to import bookings.",
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
        <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
          Loading properties...
        </div>
      ) : properties.length === 0 ? (
        <div
          style={{
            background: "white",
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
                background: "white",
                borderRadius: 16,
                padding: 28,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#1a2744",
                  marginBottom: 20,
                }}
              >
                🏠 {p.name}
              </h3>

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
                          background: "#f0f4f8",
                          borderRadius: 8,
                          padding: "10px 14px",
                          fontSize: 12,
                          fontFamily: "monospace",
                          color: "#1a2744",
                          wordBreak: "break-all",
                          marginBottom: 12,
                        }}
                      >
                        {p.airbnbIcalUrl}
                      </div>
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
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 10,
                    }}
                  >
                    ⬆️ Export to Airbnb
                  </div>
                  <div
                    style={{
                      background: "#f0f4f8",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "#1a2744",
                      wordBreak: "break-all",
                      marginBottom: 12,
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
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
