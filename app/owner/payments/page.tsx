"use client";

import React, { useState } from "react";
import { useOwnerData } from "../OwnerDataContext";
import { STATUS_COLORS, formatCurrency, formatDate, paginationBtnStyle } from "../ownerStyles";
import { PAYMENTS_PER_PAGE } from "../types";

export default function OwnerPaymentsPage() {
  const { payments } = useOwnerData();
  const [paymentsPage, setPaymentsPage] = useState(1);

  const totalPaymentsPages = Math.max(1, Math.ceil(payments.length / PAYMENTS_PER_PAGE));
  const paginatedPayments = payments.slice((paymentsPage - 1) * PAYMENTS_PER_PAGE, paymentsPage * PAYMENTS_PER_PAGE);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {payments.length === 0 ? (
        <div
          style={{
            background: "var(--brand-surface)",
            borderRadius: 20,
            padding: 60,
            textAlign: "center",
            boxShadow: "var(--shadow-s)",
            border: "1px solid var(--brand-border)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
          <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>No payments yet</h3>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Payments will appear here once bookings are created.
          </p>
        </div>
      ) : (
        <>
          {paginatedPayments.map((p) => (
            <div
              key={p.id}
              style={{
                background: "var(--brand-surface)",
                borderRadius: 20,
                border: "1px solid var(--brand-border)",
                padding: "20px 24px",
                boxShadow: `var(--shadow-s), inset 3px 0 0 ${STATUS_COLORS[p.status]?.color || "var(--brand-border)"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--brand-text)", fontSize: 15, marginBottom: 4 }}>
                    {p.Booking?.guestName || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--brand-text-muted)", marginBottom: 4 }}>
                    {p.Booking?.Property?.name || "—"} · {p.type}
                  </div>
                  {p.notes && (
                    <div style={{ fontSize: 13, color: "var(--brand-text-muted)", fontStyle: "italic" }}>{p.notes}</div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--brand-text)", marginBottom: 6 }}>
                    {formatCurrency(Number(p.amount))}
                  </div>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: STATUS_COLORS[p.status]?.bg,
                      color: STATUS_COLORS[p.status]?.color,
                    }}
                  >
                    {p.status}
                  </span>
                  {p.paidAt && (
                    <div style={{ fontSize: 11, color: "var(--brand-text-muted)", marginTop: 6 }}>
                      Paid {formatDate(p.paidAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8 }}>
            <button onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))} disabled={paymentsPage === 1} style={paginationBtnStyle(paymentsPage === 1)}>
              ‹ Prev
            </button>
            <span style={{ fontSize: 13, color: "var(--brand-text-muted)" }}>
              Page {paymentsPage} of {totalPaymentsPages}
            </span>
            <button
              onClick={() => setPaymentsPage((p) => Math.min(totalPaymentsPages, p + 1))}
              disabled={paymentsPage === totalPaymentsPages}
              style={paginationBtnStyle(paymentsPage === totalPaymentsPages)}
            >
              Next ›
            </button>
          </div>
        </>
      )}
    </div>
  );
}
