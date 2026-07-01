"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Payment {
  id: string;
  bookingId: string;
  type: string;
  amount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  Booking?: {
    guestName: string;
    checkIn: string;
    checkOut: string;
    Property?: { name: string };
  };
}

interface Booking {
  id: string;
  guestName: string;
  checkIn: string;
  Property?: { name: string };
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  DOWNPAYMENT: { bg: "#dbeafe", color: "#1e40af" },
  BALANCE: { bg: "#d1fae5", color: "#065f46" },
  FULL: { bg: "#ede9fe", color: "#5b21b6" },
  REFUND: { bg: "#fee2e2", color: "#991b1b" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "#fff3cd", color: "#856404" },
  PAID: { bg: "#d4edda", color: "#155724" },
  OVERDUE: { bg: "#f8d7da", color: "#721c24" },
  CANCELLED: { bg: "#e2e3e5", color: "#383d41" },
};

export default function FinancialsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    bookingId: "",
    type: "DOWNPAYMENT",
    amount: "",
    status: "PENDING",
    paidAt: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: paymentsData }, { data: bookingsData }] = await Promise.all([
      supabase
        .from("Payment")
        .select("*, Booking(guestName, checkIn, checkOut, Property(name))")
        .order("createdAt", { ascending: false }),
      supabase
        .from("Booking")
        .select("id, guestName, checkIn, Property(name)")
        .not("status", "eq", "CANCELLED") as any,
    ]);
    if (paymentsData) setPayments(paymentsData);
    if (bookingsData) setBookings(bookingsData);
    setLoading(false);
  }

  function openAdd() {
    setForm({
      bookingId: bookings[0]?.id || "",
      type: "DOWNPAYMENT",
      amount: "",
      status: "PENDING",
      paidAt: "",
      notes: "",
    });
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(p: Payment) {
    setForm({
      bookingId: p.bookingId,
      type: p.type,
      amount: String(p.amount),
      status: p.status,
      paidAt: p.paidAt ? p.paidAt.split("T")[0] : "",
      notes: p.notes || "",
    });
    setEditingId(p.id);
    setError("");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      bookingId: form.bookingId,
      type: form.type,
      amount: parseFloat(form.amount),
      status: form.status,
      paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : null,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("Payment")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("Payment").insert(payload);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function markPaid(id: string) {
    await supabase
      .from("Payment")
      .update({
        status: "PAID",
        paidAt: new Date().toISOString(),
      })
      .eq("id", id);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment record?")) return;
    await supabase.from("Payment").delete().eq("id", id);
    loadData();
  }

  const filtered =
    filterStatus === "ALL"
      ? payments
      : payments.filter((p) => p.status === filterStatus);

  // Summary stats
  const totalIncome = payments
    .filter((p) => p.status === "PAID" && p.type !== "REFUND")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = payments
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOverdue = payments
    .filter((p) => p.status === "OVERDUE")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalRefunds = payments
    .filter((p) => p.type === "REFUND" && p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const summaryCards = [
    {
      label: "Total Income",
      value: totalIncome,
      color: "#27ae60",
      icon: "💰",
      prefix: "₱",
    },
    {
      label: "Pending",
      value: totalPending,
      color: "#f39c12",
      icon: "⏳",
      prefix: "₱",
    },
    {
      label: "Overdue",
      value: totalOverdue,
      color: "#e74c3c",
      icon: "⚠️",
      prefix: "₱",
    },
    {
      label: "Refunds",
      value: totalRefunds,
      color: "#8896a5",
      icon: "↩️",
      prefix: "₱",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--brand-text)",
              marginBottom: 4,
            }}
          >
            Financials
          </h1>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Track income, payments and receivables
          </p>
        </div>
        <button
          onClick={openAdd}
          disabled={bookings.length === 0}
          style={{
            background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: bookings.length === 0 ? "not-allowed" : "pointer",
            opacity: bookings.length === 0 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 16px rgba(44,181,176,0.3)",
          }}
        >
          <span style={{ fontSize: 18 }}>+</span> Add Payment
        </button>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {summaryCards.map((card) => (
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
                fontSize: 22,
                fontWeight: 800,
                color: "var(--brand-text)",
                marginBottom: 2,
              }}
            >
              {card.prefix}
              {card.value.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--brand-text-muted)",
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

      {/* Filter tabs */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}
      >
        {["ALL", "PENDING", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              border: filterStatus === s ? "none" : "1.5px solid #e8edf3",
              background: filterStatus === s ? "#1a2744" : "var(--popover)",
              color: filterStatus === s ? "white" : "var(--brand-text-muted)",
              cursor: "pointer",
            }}
          >
            {s === "ALL" ? "All" : s}
          </button>
        ))}
      </div>

      {/* No bookings warning */}
      {bookings.length === 0 && (
        <div
          style={{
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 12,
            padding: "14px 20px",
            marginBottom: 24,
            fontSize: 14,
            color: "#856404",
          }}
        >
          ⚠️ Add bookings first before recording payments.
          <a
            href="/dashboard/bookings"
            style={{ color: "#1a2744", fontWeight: 600, marginLeft: 8 }}
          >
            Go to Bookings →
          </a>
        </div>
      )}

      {/* Payments list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
          Loading payments...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: "var(--popover)",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
          <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
            No payments found
          </h3>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Record your first payment to start tracking financials
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                background: "var(--popover)",
                borderRadius: 16,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                borderLeft: `4px solid ${STATUS_COLORS[p.status]?.bg}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
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
                      padding: "2px 10px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: TYPE_COLORS[p.type]?.bg,
                      color: TYPE_COLORS[p.type]?.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {p.type}
                  </span>
                  <span
                    style={{
                      padding: "2px 10px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: STATUS_COLORS[p.status]?.bg,
                      color: STATUS_COLORS[p.status]?.color,
                    }}
                  >
                    {p.status}
                  </span>
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "var(--brand-text)",
                    fontSize: 16,
                    marginBottom: 2,
                  }}
                >
                  ₱
                  {Number(p.amount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div style={{ fontSize: 13, color: "#8896a5" }}>
                  👤 {p.Booking?.guestName} · 🏠 {p.Booking?.Property?.name}
                  {p.paidAt &&
                    ` · Paid ${new Date(p.paidAt).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`}
                </div>
                {p.notes && (
                  <div style={{ fontSize: 12, color: "#aab4be", marginTop: 4 }}>
                    📝 {p.notes}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {p.status === "PENDING" && (
                  <button
                    onClick={() => markPaid(p.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      border: "none",
                      background: "#d4edda",
                      color: "#155724",
                      cursor: "pointer",
                    }}
                  >
                    ✓ Mark Paid
                  </button>
                )}
                <button
                  onClick={() => openEdit(p)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1.5px solid #e8edf3",
                    background: "white",
                    color: "#1a2744",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1.5px solid #fecaca",
                    background: "#fef2f2",
                    color: "#e74c3c",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 24,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: 36,
              width: "100%",
              maxWidth: 500,
              margin: "auto",
              boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 28,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a2744" }}>
                {editingId ? "Edit Payment" : "Add Payment"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  background: "#f0f4f8",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 18,
                  color: "#8896a5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSave}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              {/* Booking */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#8896a5",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Booking *
                </label>
                <select
                  value={form.bookingId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bookingId: e.target.value }))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1.5px solid #e8edf3",
                    borderRadius: 10,
                    fontSize: 14,
                    color: "#1a2744",
                    outline: "none",
                    background: "white",
                  }}
                >
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.guestName} — {b.Property?.name} (
                      {new Date(b.checkIn).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                      )
                    </option>
                  ))}
                </select>
              </div>

              {/* Type + Amount */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    Type *
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      border: "1.5px solid #e8edf3",
                      borderRadius: 10,
                      fontSize: 14,
                      color: "#1a2744",
                      outline: "none",
                      background: "white",
                    }}
                  >
                    {["DOWNPAYMENT", "BALANCE", "FULL", "REFUND"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    Amount (₱) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    required
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      border: "1.5px solid #e8edf3",
                      borderRadius: 10,
                      fontSize: 14,
                      color: "#1a2744",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Status + Paid date */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      border: "1.5px solid #e8edf3",
                      borderRadius: 10,
                      fontSize: 14,
                      color: "#1a2744",
                      outline: "none",
                      background: "white",
                    }}
                  >
                    {["PENDING", "PAID", "OVERDUE", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    Date Paid
                  </label>
                  <input
                    type="date"
                    value={form.paidAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, paidAt: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      border: "1.5px solid #e8edf3",
                      borderRadius: 10,
                      fontSize: 14,
                      color: "#1a2744",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#8896a5",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Optional notes..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1.5px solid #e8edf3",
                    borderRadius: 10,
                    fontSize: 14,
                    color: "#1a2744",
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#e74c3c",
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "1.5px solid #e8edf3",
                    borderRadius: 10,
                    background: "white",
                    color: "#8896a5",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 2,
                    padding: "12px",
                    background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
                    border: "none",
                    borderRadius: 10,
                    color: "white",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Save Changes"
                    : "Add Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
