"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export default function ReportsPage() {
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    const [{ data: bookings }, { data: payments }] = await Promise.all([
      supabase.from("Booking").select("checkIn, checkOut, guestCount, status"),
      supabase
        .from("Payment")
        .select("amount, status, paidAt, type")
        .eq("status", "PAID"),
    ]);

    // Build monthly data for last 6 months
    const months: Record<
      string,
      { month: string; bookings: number; guests: number; revenue: number }
    > = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      months[key] = {
        month: d.toLocaleDateString("en-PH", {
          month: "short",
          year: "2-digit",
        }),
        bookings: 0,
        guests: 0,
        revenue: 0,
      };
    }

    bookings?.forEach((b) => {
      const key = b.checkIn.substring(0, 7);
      if (months[key]) {
        months[key].bookings++;
        months[key].guests += b.guestCount;
      }
    });

    payments?.forEach((p) => {
      if (!p.paidAt) return;
      const key = p.paidAt.substring(0, 7);
      if (months[key] && p.type !== "REFUND") {
        months[key].revenue += Number(p.amount);
      }
    });

    setMonthlyData(Object.values(months));
    setLoading(false);
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
          Reports
        </h1>
        <p style={{ color: "#8896a5", fontSize: 14 }}>
          6-month overview of bookings, guests and revenue
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
          Loading reports...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Bookings chart */}
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 28,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#1a2744",
                marginBottom: 20,
              }}
            >
              📅 Monthly Bookings
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#8896a5" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#8896a5" }} />
                <Tooltip />
                <Bar
                  dataKey="bookings"
                  fill="#1a2744"
                  radius={[6, 6, 0, 0]}
                  name="Bookings"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Guests chart */}
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 28,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#1a2744",
                marginBottom: 20,
              }}
            >
              👥 Monthly Guests
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#8896a5" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#8896a5" }} />
                <Tooltip />
                <Bar
                  dataKey="guests"
                  fill="#2cb5b0"
                  radius={[6, 6, 0, 0]}
                  name="Guests"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue chart */}
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 28,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#1a2744",
                marginBottom: 20,
              }}
            >
              💰 Monthly Revenue (₱)
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#8896a5" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#8896a5" }} />
                <Tooltip
                  formatter={(val: unknown) =>
                    `₱${(val as number).toLocaleString()}`
                  }
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#27ae60"
                  strokeWidth={3}
                  dot={{ fill: "#27ae60", r: 5 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
