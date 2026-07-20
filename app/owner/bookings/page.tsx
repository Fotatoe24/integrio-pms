"use client";

import React, { useEffect, useState } from "react";
import { useOwnerData } from "../OwnerDataContext";
import {
  STATUS_COLORS,
  formatCurrency,
  formatDate,
  nights,
  getBookingPaymentBreakdown,
  getBookingPaymentState,
  paginationBtnStyle,
} from "../ownerStyles";
import { BOOKINGS_PER_PAGE } from "../types";

export default function OwnerBookingsPage() {
  const { bookings, properties } = useOwnerData();

  const [filterProperty, setFilterProperty] = useState("ALL");
  const [filterPlatform, setFilterPlatform] = useState("ALL");
  const [filterBookingStatus, setFilterBookingStatus] = useState("ALL");
  const [filterPaymentState, setFilterPaymentState] = useState("ALL");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingsPage, setBookingsPage] = useState(1);

  const filteredBookings = bookings.filter((b) => {
    if (filterBookingStatus !== "ALL" && b.status !== filterBookingStatus) return false;
    if (filterProperty !== "ALL" && b.propertyId !== filterProperty) return false;
    if (filterPlatform !== "ALL" && b.platform !== filterPlatform) return false;
    if (filterPaymentState !== "ALL" && getBookingPaymentState(b) !== filterPaymentState) return false;
    if (bookingSearch.trim()) {
      const q = bookingSearch.trim().toLowerCase();
      const matchesName = b.guestName.toLowerCase().includes(q);
      const matchesContact = (b.contactNo || "").toLowerCase().includes(q);
      if (!matchesName && !matchesContact) return false;
    }
    return true;
  });

  useEffect(() => {
    setBookingsPage(1);
  }, [filterProperty, filterPlatform, filterBookingStatus, filterPaymentState, bookingSearch]);

  const totalBookingsPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PER_PAGE));
  const paginatedBookings = filteredBookings.slice(
    (bookingsPage - 1) * BOOKINGS_PER_PAGE,
    bookingsPage * BOOKINGS_PER_PAGE
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <input
            type="text"
            value={bookingSearch}
            onChange={(e) => setBookingSearch(e.target.value)}
            placeholder="Search by name or contact..."
            style={{
              width: "100%",
              padding: "9px 14px 9px 34px",
              border: "1px solid var(--brand-border)",
              borderRadius: 12,
              fontSize: 13,
              color: "var(--brand-text)",
              outline: "none",
              background: "var(--brand-surface)",
              fontFamily: "inherit",
            }}
          />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--brand-text-muted)" }}>
            🔍
          </span>
        </div>

        <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)} className="chip-select-owner">
          <option value="ALL">All Units</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className="chip-select-owner">
          <option value="ALL">All Platforms</option>
          <option value="Facebook">Facebook</option>
          <option value="TikTok">TikTok</option>
          <option value="Airbnb">Airbnb</option>
          <option value="Direct">Direct</option>
          <option value="Walk-in">Walk-in</option>
        </select>

        <select value={filterPaymentState} onChange={(e) => setFilterPaymentState(e.target.value)} className="chip-select-owner">
          <option value="ALL">All Payments</option>
          <option value="FULLY_PAID">Fully Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>

        <select value={filterBookingStatus} onChange={(e) => setFilterBookingStatus(e.target.value)} className="chip-select-owner">
          <option value="ALL">All Status</option>
          {["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>

        {(filterProperty !== "ALL" ||
          filterPlatform !== "ALL" ||
          filterPaymentState !== "ALL" ||
          filterBookingStatus !== "ALL" ||
          bookingSearch) && (
          <button
            onClick={() => {
              setFilterProperty("ALL");
              setFilterPlatform("ALL");
              setFilterPaymentState("ALL");
              setFilterBookingStatus("ALL");
              setBookingSearch("");
            }}
            style={{
              padding: "9px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              border: "1px solid rgba(255,56,92,.3)",
              background: "rgba(255,56,92,.08)",
              color: "var(--rausch)",
              cursor: "pointer",
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredBookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--brand-text-muted)" }}>No bookings found.</div>
      ) : (
        <>
          {paginatedBookings.map((b) => {
            const { downPayment, totalCost, balance } = getBookingPaymentBreakdown(b);
            return (
              <div
                key={b.id}
                style={{
                  background: "var(--brand-surface)",
                  borderRadius: 20,
                  border: "1px solid var(--brand-border)",
                  padding: "20px 24px",
                  boxShadow: `var(--shadow-s), inset 3px 0 0 ${STATUS_COLORS[b.status]?.color || "var(--brand-border)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="m-av-owner">{b.guestName.charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--brand-text)", fontSize: 15 }}>{b.guestName}</div>
                      <div style={{ fontSize: 12, color: "var(--brand-text-muted)" }}>
                        🏠 {b.Property?.name || "—"} · {b.source}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                    {[
                      { label: "Check-in", val: formatDate(b.checkIn) },
                      { label: "Check-out", val: formatDate(b.checkOut) },
                      { label: "Nights", val: String(nights(b.checkIn, b.checkOut)) },
                    ].map((item) => (
                      <div key={item.label}>
                        <div style={{ fontSize: 11, color: "var(--brand-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-text)" }}>{item.val}</div>
                      </div>
                    ))}
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: STATUS_COLORS[b.status]?.bg,
                        color: STATUS_COLORS[b.status]?.color,
                      }}
                    >
                      {b.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", paddingTop: 14, borderTop: "1px solid var(--brand-border)" }}>
                  {[
                    { label: "Total cost", val: totalCost },
                    { label: "Down payment", val: downPayment },
                    { label: "Balance", val: balance },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ fontSize: 11, color: "var(--brand-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: item.label === "Balance" && item.val > 0 ? "var(--rausch)" : "var(--brand-text)",
                        }}
                      >
                        {formatCurrency(item.val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8 }}>
            <button onClick={() => setBookingsPage((p) => Math.max(1, p - 1))} disabled={bookingsPage === 1} style={paginationBtnStyle(bookingsPage === 1)}>
              ‹ Prev
            </button>
            <span style={{ fontSize: 13, color: "var(--brand-text-muted)" }}>
              Page {bookingsPage} of {totalBookingsPages}
            </span>
            <button
              onClick={() => setBookingsPage((p) => Math.min(totalBookingsPages, p + 1))}
              disabled={bookingsPage === totalBookingsPages}
              style={paginationBtnStyle(bookingsPage === totalBookingsPages)}
            >
              Next ›
            </button>
          </div>
        </>
      )}
    </div>
  );
}
