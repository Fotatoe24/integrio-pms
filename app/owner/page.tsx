"use client";

import React, { useMemo, useState } from "react";
import { useOwnerData } from "./OwnerDataContext";
import { formatCurrency } from "./ownerStyles";
import { ROLE_COLORS } from "./ownerStyles";
import { COMMISSION_PER_BOOKING } from "./types";
import {
  OverviewMode,
  getWeekRange,
  getMonthRange,
  getYearRange,
  formatRangeLabel,
  inRange,
  computeStats,
  computeOccupancy,
  buildChartBuckets,
  buildStayMix,
} from "./overviewHelpers";

export default function OwnerOverviewPage() {
  const { user, bookings, payments, expenseNotes, employees, properties } = useOwnerData();

  const [overviewMode, setOverviewMode] = useState<OverviewMode>("week");
  const [periodOffset, setPeriodOffset] = useState(0);

  const periodRange = useMemo<[Date, Date]>(() => {
    const now = new Date();
    if (overviewMode === "week") return getWeekRange(now, periodOffset);
    if (overviewMode === "year") return getYearRange(now, periodOffset);
    return getMonthRange(now, periodOffset);
  }, [overviewMode, periodOffset]);

  const periodLabel = useMemo(() => formatRangeLabel(periodRange, overviewMode), [periodRange, overviewMode]);

  const periodBookings = useMemo(() => bookings.filter((b) => inRange(b.checkIn, periodRange)), [bookings, periodRange]);
  const periodPayments = useMemo(() => payments.filter((p) => inRange(p.paidAt, periodRange)), [payments, periodRange]);
  const periodExpenses = useMemo(
    () => expenseNotes.filter((n) => inRange(n.createdAt, periodRange)),
    [expenseNotes, periodRange]
  );

  const periodStats = useMemo(
    () => computeStats(periodBookings, periodPayments, periodExpenses),
    [periodBookings, periodPayments, periodExpenses]
  );

  const periodOccupancy = useMemo(
    () => computeOccupancy(periodBookings, properties.length, periodRange),
    [periodBookings, properties, periodRange]
  );

  const chartBuckets = useMemo(
    () => buildChartBuckets(periodPayments, periodRange, overviewMode),
    [periodPayments, periodRange, overviewMode]
  );
  const chartMax = useMemo(() => Math.max(1, ...chartBuckets.map((b) => b.value)), [chartBuckets]);

  const stayMix = useMemo(() => buildStayMix(periodBookings), [periodBookings]);
  const stayMixTotal = stayMix.reduce((s, e) => s + e.count, 0);

  const activeTeamSize = employees.filter((e) => e.status !== "revoked").length;

  function shiftPeriod(delta: number) {
    setPeriodOffset((o) => o + delta);
  }

  const leaderboard = useMemo(() => {
    const people: { id: string; name: string; role: string }[] = [
      ...(user ? [{ id: user.id, name: user.name, role: "owner" }] : []),
      ...employees.filter((e) => e.status !== "revoked").map((e) => ({ id: e.id, name: e.name, role: e.role })),
    ];

    return people
      .map((person) => {
        const personBookings = bookings.filter((b) => b.bookedBy === person.id && b.status !== "CANCELLED");
        const revenueGenerated = personBookings.reduce((sum, b) => {
          const paid = (b.Payment || [])
            .filter((p) => p.status === "PAID")
            .reduce((s, p) => s + Number(p.amount), 0);
          return sum + paid;
        }, 0);
        return {
          person,
          bookingsCount: personBookings.length,
          revenueGenerated,
          commission: personBookings.length * COMMISSION_PER_BOOKING,
        };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [employees, bookings, user]);

  const hasAttributedBookings = bookings.some((b) => !!b.bookedBy);

  return (
    <>
      {/* Period navigator */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
        <div className="pnav-owner">
          <button onClick={() => shiftPeriod(-1)} aria-label="Previous period" className="nav-arrow-owner">
            ‹
          </button>
          <span className="pnav-label-owner">{periodLabel}</span>
          <button onClick={() => shiftPeriod(1)} aria-label="Next period" className="nav-arrow-owner">
            ›
          </button>
        </div>
        <div className="seg-owner">
          {(["week", "month", "year"] as OverviewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setOverviewMode(m);
                setPeriodOffset(0);
              }}
              className={overviewMode === m ? "active" : ""}
            >
              {m === "week" ? "Weekly" : m === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
        {/* Earnings hero + chart */}
        <div className="earn-owner">
          <div className="cap-owner">
            Net income ·{" "}
            <span>{overviewMode === "week" ? "this week" : overviewMode === "month" ? "this month" : "this year"}</span>
          </div>
          <div className="big-owner">{formatCurrency(periodStats.netIncome)}</div>
          <div style={{ fontSize: 13, color: "var(--brand-text-muted)" }}>Income minus expenses for {periodLabel}</div>

          <div className="chart-owner">
            {chartBuckets.map((b, i) => (
              <div className="bcol-owner" key={i}>
                <div className="bwrap-owner">
                  <div
                    className="bar-owner"
                    style={{ height: `${Math.max(4, Math.round((b.value / chartMax) * 100))}%` }}
                    title={formatCurrency(b.value)}
                  />
                </div>
                <span className="bx-owner">{b.label}</span>
              </div>
            ))}
          </div>

          <div className="earn-sub-owner">
            <span>
              Collected <b>₱{periodStats.collectedRevenue.toLocaleString("en-PH")}</b>
            </span>
            <span>
              Expected <b>₱{periodStats.expectedRevenue.toLocaleString("en-PH")}</b>
            </span>
            <span>
              Expenses <b>₱{periodStats.totalExpenses.toLocaleString("en-PH")}</b>
            </span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="stats-owner">
          {[
            { icon: "👥", value: String(activeTeamSize), label: "Team size" },
            {
              icon: "📅",
              value: String(periodStats.bookingsCount),
              label: `Bookings this ${overviewMode === "week" ? "week" : overviewMode === "month" ? "month" : "year"}`,
            },
            { icon: "🛏️", value: `${periodOccupancy}%`, label: "Occupancy rate" },
          ].map((s) => (
            <div key={s.label} className="stat-owner">
              <div className="lbl-owner">
                {s.icon} {s.label}
              </div>
              <div className="num-owner">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Stay mix */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--brand-text)" }}>Stay mix</div>
            <span style={{ fontSize: 12.5, color: "var(--brand-text-muted)", fontWeight: 600 }}>
              {stayMixTotal} booking{stayMixTotal === 1 ? "" : "s"}
            </span>
          </div>
          <div className="staymix-owner">
            {stayMix.map((entry) => (
              <div className="smcard-owner" key={entry.key}>
                <div className="sm-top-owner">
                  <span className="sm-count-owner">{entry.count}</span>
                  <span className="sm-pct-owner" style={{ color: entry.colorVar }}>
                    {entry.pct}%
                  </span>
                </div>
                <div className="sm-label-owner">
                  {entry.label} <span className="hrs-owner">{entry.hrs}</span>
                </div>
                <div className="sm-note-owner">{entry.note}</div>
                <div className="sm-bar-owner">
                  <i style={{ width: `${entry.pct}%`, background: entry.colorVar }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Commission leaderboard */}
      <div
        style={{
          background: "var(--brand-surface)",
          borderRadius: 20,
          boxShadow: "var(--shadow-s)",
          border: "1px solid var(--brand-border)",
          padding: "22px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--brand-text)" }}>🏆 Commission leaderboard</div>
          <span style={{ fontSize: 11, color: "var(--brand-text-muted)", fontWeight: 600 }}>
            ₱{COMMISSION_PER_BOOKING} per booking handled
          </span>
        </div>

        {!hasAttributedBookings && (
          <p style={{ fontSize: 12, color: "var(--brand-text-muted)", marginBottom: 12 }}>
            No bookings are attributed to an employee yet, so commissions can&apos;t be calculated. Make sure bookings
            store which employee handled them.
          </p>
        )}

        {leaderboard.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--brand-text-muted)" }}>No active employees yet.</p>
        ) : (
          leaderboard.map((entry, i) => (
            <div
              key={entry.person.id}
              className="member-row-owner"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--brand-border)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 28, textAlign: "center", fontSize: 15, fontWeight: 800, color: "var(--brand-text-muted)" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </div>
                <div className="m-av-owner">{entry.person.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--brand-text)", display: "flex", alignItems: "center", gap: 6 }}>
                    {entry.person.name}
                    <span
                      style={{
                        padding: "1px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: ROLE_COLORS[entry.person.role]?.bg,
                        color: ROLE_COLORS[entry.person.role]?.color,
                      }}
                    >
                      {entry.person.role}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--brand-text-muted)", fontWeight: 600 }}>
                    {entry.bookingsCount} booking{entry.bookingsCount === 1 ? "" : "s"} · {formatCurrency(entry.revenueGenerated)} collected
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--brand-text)", whiteSpace: "nowrap" }}>
                {formatCurrency(entry.commission)}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
