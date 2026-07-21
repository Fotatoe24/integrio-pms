"use client";

import React, { useEffect, useState } from "react";
import { useOwnerData } from "../OwnerDataContext";
import { inputStyle, labelStyle, formatCurrency } from "../ownerStyles";

interface Property {
  id: string;
  name: string;
  shortName: string | null;
  unitNumber: string | null;
}

interface Bill {
  id: string;
  propertyId: string;
  key: string;
  label: string | null;
  month: string;
  dueDay: number | null;
  recurring: boolean;
  amountDue: number;
  amountPaid: number | null;
  paid: boolean;
  note: string | null;
  paidAt: string | null;
  accountNumber: string | null;
  property: Property | null;
}

// Common bill categories, kept as free-text `key` so owners aren't locked
// into a fixed enum — this list just seeds the dropdown with sane defaults.
const COMMON_KEYS = [
  "electricity",
  "water",
  "internet",
  "association_dues",
  "insurance",
  "other",
];

function monthLabel(monthStr: string) {
  const d = new Date(monthStr);
  return d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
}

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function OwnerBillsPage() {
  const { user } = useOwnerData();

  const [month, setMonth] = useState(currentMonthStr());
  const [bills, setBills] = useState<Bill[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    propertyId: "",
    key: "electricity",
    label: "",
    dueDay: "",
    recurring: true,
    amountDue: "",
    accountNumber: "",
    note: "",
  });

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, month]);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/owner/bills?owner_id=${user.id}&month=${month}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load bills");
      setBills(json.bills || []);
      setProperties(json.properties || []);
      if (!form.propertyId && json.properties?.[0]) {
        setForm((f) => ({ ...f, propertyId: json.properties[0].id }));
      }
    } catch (e: any) {
      setError(e.message || "Failed to load bills");
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!user || !form.propertyId || !form.amountDue) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/owner/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: user.id,
          propertyId: form.propertyId,
          key: form.key,
          label: form.label || null,
          month,
          dueDay: form.dueDay ? Number(form.dueDay) : null,
          recurring: form.recurring,
          amountDue: Number(form.amountDue),
          accountNumber: form.accountNumber || null,
          note: form.note || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add bill");
      setShowForm(false);
      setForm((f) => ({
        ...f,
        label: "",
        dueDay: "",
        amountDue: "",
        accountNumber: "",
        note: "",
      }));
      load();
    } catch (e: any) {
      setError(e.message || "Failed to add bill");
    }
    setSaving(false);
  }

  async function markPaid(bill: Bill) {
    if (!user) return;
    const amountPaid = prompt(
      `Amount paid for ${bill.label || bill.key} (₱${bill.amountDue})?`,
      String(bill.amountDue)
    );
    if (amountPaid === null) return;
    await fetch("/api/owner/bills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: bill.id,
        owner_id: user.id,
        amountPaid: Number(amountPaid),
        paid: true,
      }),
    });
    load();
  }

  async function unmarkPaid(bill: Bill) {
    if (!user) return;
    await fetch("/api/owner/bills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: bill.id, owner_id: user.id, paid: false }),
    });
    load();
  }

  async function handleDelete(bill: Bill) {
    if (!user) return;
    if (!confirm(`Delete ${bill.label || bill.key}? This cannot be undone.`))
      return;
    await fetch(`/api/owner/bills?id=${bill.id}&owner_id=${user.id}`, {
      method: "DELETE",
    });
    load();
  }

  const totalDue = bills.reduce((s, b) => s + Number(b.amountDue), 0);
  const totalPaid = bills
    .filter((b) => b.paid)
    .reduce((s, b) => s + Number(b.amountPaid ?? b.amountDue), 0);
  const outstanding = totalDue - totalPaid;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Month navigator + add button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            style={navBtnStyle}
          >
            ‹
          </button>
          <span
            style={{
              fontWeight: 800,
              fontSize: 15,
              minWidth: 150,
              textAlign: "center",
              color: "var(--brand-text)",
            }}
          >
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            style={navBtnStyle}
          >
            ›
          </button>
        </div>

        <button
          onClick={() => setShowForm(true)}
          disabled={properties.length === 0}
          style={{
            background: "var(--rausch)",
            border: "1px solid var(--rausch)",
            color: "white",
            borderRadius: 12,
            padding: "11px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: properties.length === 0 ? "not-allowed" : "pointer",
            opacity: properties.length === 0 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>+</span> Add Bill
        </button>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
        }}
      >
        {[
          { label: "Total due", value: totalDue, color: "var(--brand-text)" },
          { label: "Paid", value: totalPaid, color: "var(--green)" },
          {
            label: "Outstanding",
            value: outstanding,
            color: outstanding > 0 ? "var(--rausch)" : "var(--green)",
          },
        ].map((s) => (
          <div
            key={s.label}
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
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>
              {formatCurrency(s.value)}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div
          style={{
            background: "rgba(255,56,92,.08)",
            border: "1px solid rgba(255,56,92,.3)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--rausch)",
          }}
        >
          {error}
        </div>
      )}

      {/* Bills list */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--brand-text-muted)",
          }}
        >
          Loading bills...
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          icon="🏠"
          title="No properties yet"
          desc="Add a property first before tracking bills."
        />
      ) : bills.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No bills for this month"
          desc="Add electricity, water, internet, or other recurring bills using the button above."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {bills.map((bill) => (
            <div
              key={bill.id}
              style={{
                background: "var(--brand-surface)",
                borderRadius: 20,
                boxShadow: "var(--shadow-s)",
                border: "1px solid var(--brand-border)",
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
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
                    {bill.label || bill.key}
                  </span>
                  {bill.recurring && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 8px",
                        borderRadius: 999,
                        background: "var(--bg-2, rgba(0,0,0,.05))",
                        color: "var(--brand-text-muted)",
                      }}
                    >
                      RECURRING
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--brand-text-muted)" }}>
                  🏠 {bill.property?.shortName || bill.property?.name || "Unit"}
                  {bill.dueDay && ` · Due day ${bill.dueDay}`}
                  {bill.accountNumber && ` · Acct ${bill.accountNumber}`}
                </div>
                {bill.note && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--brand-text-muted)",
                      marginTop: 4,
                    }}
                  >
                    📝 {bill.note}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 16,
                      color: "var(--brand-text)",
                    }}
                  >
                    {formatCurrency(Number(bill.amountDue))}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 10px",
                      borderRadius: 999,
                      background: bill.paid
                        ? "rgba(0,138,5,.13)"
                        : "rgba(200,125,0,.15)",
                      color: bill.paid ? "var(--green)" : "var(--amber)",
                    }}
                  >
                    {bill.paid ? "Paid" : "Unpaid"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {bill.paid ? (
                    <button
                      onClick={() => unmarkPaid(bill)}
                      style={secondaryBtnStyle}
                    >
                      Undo
                    </button>
                  ) : (
                    <button
                      onClick={() => markPaid(bill)}
                      style={primaryBtnStyle}
                    >
                      Mark Paid
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(bill)}
                    style={dangerBtnStyle}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Bill modal */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 24,
          }}
        >
          <div
            style={{
              background: "var(--brand-surface)",
              borderRadius: 20,
              padding: 36,
              width: "100%",
              maxWidth: 480,
              boxShadow: "var(--shadow)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "var(--brand-text)",
                }}
              >
                Add Bill — {monthLabel(month)}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  background: "var(--brand-bg)",
                  border: "1px solid var(--brand-border)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 18,
                  color: "var(--brand-text-muted)",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Unit *</label>
                <select
                  value={form.propertyId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, propertyId: e.target.value }))
                  }
                  style={inputStyle}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName || p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={labelStyle}>Bill type *</label>
                  <select
                    value={form.key}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, key: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    {COMMON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Amount due (₱) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amountDue}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amountDue: e.target.value }))
                    }
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Custom label</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="e.g. Meralco — Unit 1116"
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={labelStyle}>Due day of month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.dueDay}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dueDay: e.target.value }))
                    }
                    placeholder="e.g. 15"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Account number</label>
                  <input
                    type="text"
                    value={form.accountNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accountNumber: e.target.value }))
                    }
                    style={inputStyle}
                  />
                </div>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--brand-text)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.recurring}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, recurring: e.target.checked }))
                  }
                />
                Recurs monthly (a reminder for next month — doesn't auto-create
                it yet)
              </label>

              <div>
                <label style={labelStyle}>Note</label>
                <textarea
                  value={form.note}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, note: e.target.value }))
                  }
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "rgba(255,56,92,.08)",
                    border: "1px solid rgba(255,56,92,.3)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "var(--rausch)",
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    flex: 1,
                    padding: 12,
                    border: "1px solid var(--brand-border)",
                    borderRadius: 12,
                    background: "var(--brand-surface)",
                    color: "var(--brand-text-muted)",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.propertyId || !form.amountDue}
                  style={{
                    flex: 2,
                    padding: 12,
                    background:
                      saving || !form.propertyId || !form.amountDue
                        ? "var(--brand-border)"
                        : "var(--rausch)",
                    border: "none",
                    borderRadius: 12,
                    color:
                      saving || !form.propertyId || !form.amountDue
                        ? "var(--brand-text-muted)"
                        : "white",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor:
                      saving || !form.propertyId || !form.amountDue
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {saving ? "Saving..." : "Add bill"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
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
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>{desc}</p>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid var(--brand-border)",
  background: "var(--brand-surface)",
  color: "var(--brand-text)",
  cursor: "pointer",
  fontSize: 18,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid rgba(0,138,5,.3)",
  background: "rgba(0,138,5,.08)",
  color: "var(--green)",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid var(--brand-border)",
  background: "var(--brand-surface)",
  color: "var(--brand-text-muted)",
  cursor: "pointer",
};

const dangerBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  border: "1px solid rgba(255,56,92,.3)",
  background: "rgba(255,56,92,.08)",
  color: "var(--rausch)",
  cursor: "pointer",
};
