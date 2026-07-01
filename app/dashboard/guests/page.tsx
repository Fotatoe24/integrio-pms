"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface GuestStat {
  guestName: string;
  guestEmail: string | null;
  totalBookings: number;
  totalNights: number;
  lastStay: string;
  properties: string[];
}

export default function GuestsPage() {
  const [guests, setGuests] = useState<GuestStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [todayGuests, setTodayGuests] = useState(0);
  const [weekGuests, setWeekGuests] = useState(0);
  const [monthGuests, setMonthGuests] = useState(0);

  useEffect(() => {
    loadGuests();
  }, []);

  async function loadGuests() {
    setLoading(true);
    const { data } = await supabase
      .from("Booking")
      .select(
        "guestName, guestEmail, guestCount, checkIn, checkOut, status, Property(name)"
      )
      .not("status", "eq", "CANCELLED")
      .order("checkIn", { ascending: false });

    if (!data) {
      setLoading(false);
      return;
    }

    // Today's guests
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setDate(today.getDate() + 30);

    let todayCount = 0,
      weekCount = 0,
      monthCount = 0;

    data.forEach((b) => {
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      const isActive = checkIn <= tomorrow && checkOut >= today;

      if (isActive) {
        todayCount += b.guestCount;
        if (checkIn <= weekEnd) weekCount += b.guestCount;
        if (checkIn <= monthEnd) monthCount += b.guestCount;
      }
    });

    setTodayGuests(todayCount);
    setWeekGuests(weekCount);
    setMonthGuests(monthCount);

    // Group by guest
    const guestMap: Record<string, GuestStat> = {};
    data.forEach((b) => {
      const key = b.guestName.toLowerCase();
      const nights = Math.round(
        (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const propName = (b.Property as any)?.name || "Unknown";

      if (!guestMap[key]) {
        guestMap[key] = {
          guestName: b.guestName,
          guestEmail: b.guestEmail,
          totalBookings: 0,
          totalNights: 0,
          lastStay: b.checkIn,
          properties: [],
        };
      }

      guestMap[key].totalBookings++;
      guestMap[key].totalNights += nights;
      if (!guestMap[key].properties.includes(propName)) {
        guestMap[key].properties.push(propName);
      }
      if (new Date(b.checkIn) > new Date(guestMap[key].lastStay)) {
        guestMap[key].lastStay = b.checkIn;
      }
    });

    setGuests(
      Object.values(guestMap).sort((a, b) => b.totalBookings - a.totalBookings)
    );
    setLoading(false);
  }

  const filtered = guests.filter(
    (g) =>
      g.guestName.toLowerCase().includes(search.toLowerCase()) ||
      (g.guestEmail || "").toLowerCase().includes(search.toLowerCase())
  );

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
          Guests
        </h1>
        <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
          Guest count and stay reports
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {[
          {
            label: "Guests Today",
            value: todayGuests,
            icon: "📅",
            color: "#2cb5b0",
          },
          {
            label: "Guests This Week",
            value: weekGuests,
            icon: "📆",
            color: "#1a2744",
          },
          {
            label: "Guests This Month",
            value: monthGuests,
            icon: "🗓️",
            color: "#27ae60",
          },
          {
            label: "Total Unique Guests",
            value: guests.length,
            icon: "👥",
            color: "#8896a5",
          },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--popover)",
              borderRadius: 16,
              padding: "20px 24px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              borderTop: `4px solid ${card.color}`,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "var(--brand-text)",
                marginBottom: 2,
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#8896a5",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search guests by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "10px 16px",
            border: "1.5px solid #e8edf3",
            borderRadius: 10,
            fontSize: 14,
            color: "var(--brand-text)",
            outline: "none",
            background: "var(--background)",
          }}
        />
      </div>

      {/* Guest list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
          Loading guests...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: "var(--background)",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <h3 style={{ color: "#1a2744", marginBottom: 8 }}>No guests found</h3>
          <p style={{ color: "#8896a5", fontSize: 14 }}>
            Guests will appear here once bookings are added
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--popover)",
            borderRadius: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--background)",
                  borderBottom: "1px solid #e8edf3",
                }}
              >
                {[
                  "Guest",
                  "Email",
                  "Bookings",
                  "Nights",
                  "Properties",
                  "Last Stay",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 20px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--brand-text)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid #f0f4f8",
                    transition: "background 0.15s",
                  }}
                >
                  <td style={{ padding: "14px 20px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background:
                            "linear-gradient(135deg, #1a2744, #2cb5b0)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {g.guestName.charAt(0).toUpperCase()}
                      </div>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--brand-text)",
                          fontSize: 14,
                        }}
                      >
                        {g.guestName}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: 13,
                      color: "#8896a5",
                    }}
                  >
                    {g.guestEmail || "—"}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span
                      style={{
                        background: "#dbeafe",
                        color: "#1e40af",
                        padding: "2px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {g.totalBookings}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1a2744",
                    }}
                  >
                    {g.totalNights}
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: 13,
                      color: "#8896a5",
                    }}
                  >
                    {g.properties.join(", ")}
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: 13,
                      color: "#8896a5",
                    }}
                  >
                    {new Date(g.lastStay).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
