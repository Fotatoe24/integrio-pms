"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    properties: 0,
    bookings: 0,
    guests: 0,
    revenue: 0,
  });

  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  useEffect(() => {
    async function loadStats() {
      const [{ count: properties }, { count: bookings }, { data: payments }] =
        await Promise.all([
          supabase.from("Property").select("*", { count: "exact", head: true }),
          supabase.from("Booking").select("*", { count: "exact", head: true }),
          supabase.from("Payment").select("amount").eq("status", "PAID"),
        ]);

      const revenue =
        payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      setStats({
        properties: properties || 0,
        bookings: bookings || 0,
        guests: 0,
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
            color: "#1a2744",
            marginBottom: 4,
          }}
        >
          Good {getGreeting()}, Admin 👋
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
              background: "white",
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
                color: "#1a2744",
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
          background: "white",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#1a2744",
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
              bg: "#1a2744",
            },
            {
              label: "+ New Booking",
              href: "/dashboard/bookings",
              bg: "#2cb5b0",
            },
            { label: "↻ Sync iCal", href: "/dashboard/ical", bg: "#8896a5" },
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
