"use client";

import React from "react";
import { useOwnerData } from "../OwnerDataContext";
import { CATEGORY_COLORS, formatCurrency, formatDateTime } from "../ownerStyles";

export default function OwnerExpensesPage() {
  const { expenseNotes } = useOwnerData();

  return (
    <div className="exp-owner">
      {expenseNotes.length === 0 ? (
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
          <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>No expenses recorded</h3>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Expenses added by housekeeping and auditors will appear here.
          </p>
        </div>
      ) : (
        expenseNotes.map((note) => {
          const d = new Date(note.createdAt);
          return (
            <div className="exp-row-owner" key={note.id}>
              <div className="exp-date-owner">
                <span className="m">{d.toLocaleDateString("en-PH", { month: "short" })}</span>
                <span className="d">{d.getDate()}</span>
              </div>
              <div className="exp-info-owner">
                <div className="exp-title-owner">
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: CATEGORY_COLORS[note.category]?.bg,
                      color: CATEGORY_COLORS[note.category]?.color,
                    }}
                  >
                    {note.category}
                  </span>
                </div>
                <div className="exp-note-owner">{note.content}</div>
                <div style={{ fontSize: 11, color: "var(--brand-text-muted)", marginTop: 4 }}>{formatDateTime(note.createdAt)}</div>
              </div>
              {note.amount > 0 && <div className="exp-amt-owner">{formatCurrency(Number(note.amount))}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
