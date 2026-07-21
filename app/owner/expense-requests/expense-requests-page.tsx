"use client";

import React, { useEffect, useState } from "react";
import { useOwnerData } from "../OwnerDataContext";
import { formatCurrency } from "../ownerStyles";

interface Employee {
  id: string;
  name: string;
  role: string;
  userId: string | null;
}

interface Property {
  id: string;
  name: string;
  shortName: string | null;
}

interface ExpenseRequest {
  id: string;
  employeeId: string;
  category: string;
  propertyId: string | null;
  amount: number;
  note: string;
  receiptUrl: string | null;
  date: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  rejectionReason: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  employee: Employee | null;
  Property: Property | null;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "rgba(200,125,0,.15)", color: "var(--amber)" },
  APPROVED: { bg: "rgba(0,138,5,.13)", color: "var(--green)" },
  REJECTED: { bg: "rgba(255,56,92,.14)", color: "var(--rausch)" },
};

const TABS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OwnerExpenseRequestsPage() {
  const { user } = useOwnerData();

  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("PENDING");
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab]);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const statusParam = activeTab === "ALL" ? "" : `&status=${activeTab}`;
      const res = await fetch(
        `/api/owner/expense-requests?owner_id=${user.id}${statusParam}`
      );
      const json = await res.json();
      setRequests(json.requests || []);
      setNote(json.note || "");
    } catch {
      setRequests([]);
    }
    setLoading(false);
  }

  async function handleApprove(id: string) {
    if (!user) return;
    setActingId(id);
    await fetch("/api/owner/expense-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, owner_id: user.id, action: "approve" }),
    });
    setActingId(null);
    load();
  }

  async function handleReject(id: string) {
    if (!user || !rejectionReason.trim()) return;
    setActingId(id);
    await fetch("/api/owner/expense-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        owner_id: user.id,
        action: "reject",
        rejectionReason: rejectionReason.trim(),
      }),
    });
    setActingId(null);
    setRejectingId(null);
    setRejectionReason("");
    load();
  }

  const pendingTotal = requests
    .filter((r) => r.status === "PENDING")
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {note && (
        <div
          style={{
            background: "rgba(200,125,0,.08)",
            border: "1px solid rgba(200,125,0,.25)",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 13,
            color: "var(--amber)",
          }}
        >
          ⚠️ {note}
        </div>
      )}

      {activeTab === "PENDING" && pendingTotal > 0 && (
        <div
          style={{
            background: "var(--brand-surface)",
            borderRadius: 16,
            border: "1px solid var(--brand-border)",
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--brand-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Pending — awaiting your review
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--amber)" }}>
            {formatCurrency(pendingTotal)}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 600,
              border: "none",
              background:
                activeTab === tab ? "rgba(255,56,92,.12)" : "transparent",
              color:
                activeTab === tab ? "var(--rausch)" : "var(--brand-text-muted)",
              cursor: "pointer",
            }}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--brand-text-muted)",
          }}
        >
          Loading requests...
        </div>
      ) : requests.length === 0 ? (
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
          <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
            No {activeTab === "ALL" ? "" : activeTab.toLowerCase()} requests
          </h3>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Expense requests submitted by staff will show up here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requests.map((r) => (
            <div
              key={r.id}
              style={{
                background: "var(--brand-surface)",
                borderRadius: 20,
                border: "1px solid var(--brand-border)",
                padding: "20px 24px",
                boxShadow: `var(--shadow-s), inset 3px 0 0 ${
                  STATUS_COLORS[r.status]?.color || "var(--brand-border)"
                }`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: "var(--brand-text)",
                        fontSize: 15,
                      }}
                    >
                      {r.employee?.name || "Unknown employee"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 10px",
                        borderRadius: 999,
                        background: "var(--bg-2, rgba(0,0,0,.05))",
                        color: "var(--brand-text-muted)",
                      }}
                    >
                      {r.category}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: 12, color: "var(--brand-text-muted)" }}
                  >
                    {formatDate(r.date)}
                    {r.Property &&
                      ` · 🏠 ${r.Property.shortName || r.Property.name}`}
                  </div>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: "var(--brand-text)",
                      marginTop: 8,
                    }}
                  >
                    {r.note}
                  </p>
                  {r.receiptUrl && (
                    <a
                      href={r.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        color: "var(--rausch)",
                        fontWeight: 600,
                      }}
                    >
                      View receipt →
                    </a>
                  )}
                  {r.status === "REJECTED" && r.rejectionReason && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: "var(--rausch)",
                        fontStyle: "italic",
                      }}
                    >
                      Rejected: {r.rejectionReason}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: "var(--brand-text)",
                    }}
                  >
                    {formatCurrency(Number(r.amount))}
                  </div>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: STATUS_COLORS[r.status]?.bg,
                      color: STATUS_COLORS[r.status]?.color,
                    }}
                  >
                    {r.status}
                  </span>
                </div>
              </div>

              {r.status === "PENDING" && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    paddingTop: 14,
                    borderTop: "1px solid var(--brand-border)",
                    flexWrap: "wrap",
                  }}
                >
                  {rejectingId === r.id ? (
                    <>
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason for rejecting..."
                        style={{
                          flex: 1,
                          minWidth: 200,
                          padding: "9px 14px",
                          border: "1px solid var(--brand-border)",
                          borderRadius: 10,
                          fontSize: 13,
                          background: "var(--brand-surface)",
                          color: "var(--brand-text)",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={actingId === r.id || !rejectionReason.trim()}
                        style={{
                          padding: "9px 16px",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          border: "1px solid rgba(255,56,92,.3)",
                          background: "rgba(255,56,92,.08)",
                          color: "var(--rausch)",
                          cursor: rejectionReason.trim()
                            ? "pointer"
                            : "not-allowed",
                        }}
                      >
                        Confirm reject
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectionReason("");
                        }}
                        style={{
                          padding: "9px 16px",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          border: "1px solid var(--brand-border)",
                          background: "var(--brand-surface)",
                          color: "var(--brand-text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={actingId === r.id}
                        style={{
                          padding: "9px 18px",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          border: "1px solid rgba(0,138,5,.3)",
                          background: "rgba(0,138,5,.08)",
                          color: "var(--green)",
                          cursor: "pointer",
                        }}
                      >
                        {actingId === r.id ? "Working..." : "✓ Approve"}
                      </button>
                      <button
                        onClick={() => setRejectingId(r.id)}
                        style={{
                          padding: "9px 18px",
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          border: "1px solid rgba(255,56,92,.3)",
                          background: "rgba(255,56,92,.08)",
                          color: "var(--rausch)",
                          cursor: "pointer",
                        }}
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
