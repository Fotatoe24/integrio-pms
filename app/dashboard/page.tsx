"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    properties: 0,
    bookings: 0,
    guests: 0,
    revenue: 0,
  });
  const [userName, setUserName] = useState("there");

  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  useEffect(() => {
    async function loadStats() {
      const user = getCurrentUser();
      if (!user) return;
      setUserName(user.name || "there");

      const ownerId = user.owner_id ?? user.id;

      // Step 1 — get this owner's properties
      const { data: props } = await supabase
        .from("Property")
        .select("id")
        .eq("owner_id", ownerId);

      const propertyIds = (props ?? []).map((p) => p.id);

      // Step 2 — get bookings only for those properties
      const { data: bookings } =
        propertyIds.length > 0
          ? await supabase
              .from("Booking")
              .select("id, guestCount")
              .in("propertyId", propertyIds)
          : { data: [] };

      const bookingIds = (bookings ?? []).map((b) => b.id);

      // Step 3 — get payments only for those bookings
      const { data: payments } =
        bookingIds.length > 0
          ? await supabase
              .from("Payment")
              .select("amount")
              .eq("status", "PAID")
              .in("bookingId", bookingIds)
          : { data: [] };

      const revenue =
        payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Active guests — count bookings currently checked in
      const { count: activeGuests } =
        propertyIds.length > 0
          ? await supabase
              .from("Booking")
              .select("*", { count: "exact", head: true })
              .in("propertyId", propertyIds)
              .eq("status", "CHECKED_IN")
          : { count: 0 };

      setStats({
        properties: propertyIds.length,
        bookings: bookings?.length || 0,
        guests: activeGuests || 0,
        revenue,
      });
    }
    loadStats();
  }, []);

  const cards = [
    {
      label: "Properties",
      value: stats.properties,
      color: "#1a2744",
      icon: "🏠",
    },
    {
      label: "Total Bookings",
      value: stats.bookings,
      color: "#2cb5b0",
      icon: "📅",
    },
    {
      label: "Total Revenue",
      value: `₱${stats.revenue.toLocaleString()}`,
      color: "#27ae60",
      icon: "💰",
    },
    {
      label: "Active Guests",
      value: stats.guests,
      color: "#e67e22",
      icon: "👥",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--brand-text)",
            marginBottom: 4,
          }}
        >
          Good {getGreeting()}, {userName} 👋
        </h1>
        <p style={{ color: "#8896a5", fontSize: 14 }}>
          Here's what's happening with your properties today.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          marginBottom: 32,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--popover)",
              borderRadius: 16,
              padding: "24px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              borderTop: `4px solid ${card.color}`,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>{card.icon}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "var(--brand-text)",
                marginBottom: 4,
              }}
            >
              {card.value}
            </div>
            <div style={{ fontSize: 13, color: "#8896a5", fontWeight: 500 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "var(--popover)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--brand-text)",
            marginBottom: 16,
          }}
        >
          Quick Actions
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            {
              label: "+ Add Property",
              href: "/dashboard/properties",
              bg: "var(--brand-text)",
            },
            {
              label: "+ New Booking",
              href: "/dashboard/bookings",
              bg: "var(--brand-text)",
            },
            {
              label: "↻ Sync iCal",
              href: "/dashboard/ical",
              bg: "var(--brand-text)",
            },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              style={{
                background: action.bg,
                color: "white",
                padding: "10px 20px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
