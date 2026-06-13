"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Property {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  type: string;
  amount: number;
  status: string;
  paidAt: string | null;
}

interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  guestEmail: string | null;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  status: string;
  source: string;
  notes: string | null;
  Property?: { name: string };
  Payment?: Payment[];
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "#fff3cd", color: "#856404" },
  CONFIRMED: { bg: "#d1ecf1", color: "#0c5460" },
  CHECKED_IN: { bg: "#d4edda", color: "#155724" },
  CHECKED_OUT: { bg: "#e2e3e5", color: "#383d41" },
  CANCELLED: { bg: "#f8d7da", color: "#721c24" },
};

const SOURCE_ICONS: Record<string, string> = {
  DIRECT: "🔗",
  AIRBNB: "🏠",
  MANUAL: "✏️",
};

type ViewMode = "list" | "calendar";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [expandedPayments, setExpandedPayments] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState("");

  const [form, setForm] = useState({
    propertyId: "",
    guestName: "",
    guestEmail: "",
    guestCount: 1,
    checkIn: "",
    checkOut: "",
    status: "CONFIRMED",
    source: "DIRECT",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: bookingsData }, { data: propertiesData }] =
      await Promise.all([
        supabase
          .from("Booking")
          .select(
            "*, Property(name), Payment(id, type, amount, status, paidAt)"
          )
          .order("checkIn", { ascending: false }),
        supabase.from("Property").select("id, name"),
      ]);
    if (bookingsData) setBookings(bookingsData);
    if (propertiesData) setProperties(propertiesData);
    setLoading(false);
  }

  function openAdd() {
    setForm({
      propertyId: properties[0]?.id || "",
      guestName: "",
      guestEmail: "",
      guestCount: 1,
      checkIn: "",
      checkOut: "",
      status: "CONFIRMED",
      source: "DIRECT",
      notes: "",
    });
    setEditingId(null);
    setError("");
    setConflictWarning("");
    setShowForm(true);
  }

  function openEdit(b: Booking) {
    setForm({
      propertyId: b.propertyId,
      guestName: b.guestName,
      guestEmail: b.guestEmail || "",
      guestCount: b.guestCount,
      checkIn: b.checkIn.split("T")[0],
      checkOut: b.checkOut.split("T")[0],
      status: b.status,
      source: b.source,
      notes: b.notes || "",
    });
    setEditingId(b.id);
    setError("");
    setConflictWarning("");
    setShowForm(true);
  }

  // ── Conflict detection ───────────────────────────────────────────────────
  function checkConflict(
    propertyId: string,
    checkIn: string,
    checkOut: string,
    excludeId?: string
  ) {
    if (!propertyId || !checkIn || !checkOut) return "";
    const newIn = new Date(checkIn).getTime();
    const newOut = new Date(checkOut).getTime();

    const conflict = bookings.find((b) => {
      if (b.id === excludeId) return false;
      if (b.propertyId !== propertyId) return false;
      if (b.status === "CANCELLED" || b.status === "CHECKED_OUT") return false;
      const bIn = new Date(b.checkIn).getTime();
      const bOut = new Date(b.checkOut).getTime();
      return newIn < bOut && newOut > bIn;
    });

    if (conflict) {
      return `⚠️ Conflict with ${conflict.guestName} (${new Date(
        conflict.checkIn
      ).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      })} – ${new Date(conflict.checkOut).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      })})`;
    }
    return "";
  }

  function handleFormChange(patch: Partial<typeof form>) {
    const updated = { ...form, ...patch };
    setForm(updated);
    if (updated.propertyId && updated.checkIn && updated.checkOut) {
      const warning = checkConflict(
        updated.propertyId,
        updated.checkIn,
        updated.checkOut,
        editingId ?? undefined
      );
      setConflictWarning(warning);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    // Block save if conflict exists
    const conflict = checkConflict(
      form.propertyId,
      form.checkIn,
      form.checkOut,
      editingId ?? undefined
    );
    if (conflict && form.status !== "CANCELLED") {
      setError(conflict);
      setSaving(false);
      return;
    }

    if (new Date(form.checkOut) <= new Date(form.checkIn)) {
      setError("Check-out must be after check-in.");
      setSaving(false);
      return;
    }

    const payload = {
      propertyId: form.propertyId,
      guestName: form.guestName,
      guestEmail: form.guestEmail || null,
      guestCount: Number(form.guestCount),
      checkIn: new Date(form.checkIn).toISOString(),
      checkOut: new Date(form.checkOut).toISOString(),
      status: form.status,
      source: form.source,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("Booking")
        .update(payload)
        .eq("id", editingId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("Booking").insert(payload);
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this booking?")) return;
    await supabase.from("Booking").delete().eq("id", id);
    loadData();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("Booking").update({ status }).eq("id", id);
    loadData();
  }

  function nights(checkIn: string, checkOut: string) {
    return Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
    );
  }

  // ── Payment summary helpers ──────────────────────────────────────────────
  function paymentSummary(payments: Payment[] = []) {
    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    const paid = payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + Number(p.amount), 0);
    const pending = payments
      .filter((p) => p.status === "PENDING")
      .reduce((s, p) => s + Number(p.amount), 0);
    return { total, paid, pending, balance: total - paid };
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────
  function getCalendarDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }

  function getBookingsForDay(year: number, month: number, day: number) {
    const date = new Date(year, month, day);
    return bookings.filter((b) => {
      if (b.status === "CANCELLED") return false;
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      checkIn.setHours(0, 0, 0, 0);
      checkOut.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      return date >= checkIn && date < checkOut;
    });
  }

  const filtered =
    filterStatus === "ALL"
      ? bookings
      : bookings.filter((b) => b.status === filterStatus);

  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const calDays = getCalendarDays(calYear, calMonth);
  const monthName = calendarDate.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  const fieldLabel: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#8896a5",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  };

  const fieldInput: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #e8edf3",
    borderRadius: 10,
    fontSize: 14,
    color: "#1a2744",
    outline: "none",
    background: "white",
    fontFamily: "inherit",
  };

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
              color: "#1a2744",
              marginBottom: 4,
            }}
          >
            Bookings
          </h1>
          <p style={{ color: "#8896a5", fontSize: 14 }}>
            {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* View toggle */}
          <div
            style={{
              display: "flex",
              border: "1.5px solid #e8edf3",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {(["list", "calendar"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  background: viewMode === v ? "#1a2744" : "white",
                  color: viewMode === v ? "white" : "#8896a5",
                  cursor: "pointer",
                }}
              >
                {v === "list" ? "☰ List" : "📅 Calendar"}
              </button>
            ))}
          </div>
          <button
            onClick={openAdd}
            disabled={properties.length === 0}
            style={{
              background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: properties.length === 0 ? "not-allowed" : "pointer",
              opacity: properties.length === 0 ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 16px rgba(44,181,176,0.3)",
            }}
          >
            <span style={{ fontSize: 18 }}>+</span> New Booking
          </button>
        </div>
      </div>

      {/* Filter tabs — list view only */}
      {viewMode === "list" && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          {[
            "ALL",
            "PENDING",
            "CONFIRMED",
            "CHECKED_IN",
            "CHECKED_OUT",
            "CANCELLED",
          ].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                border: filterStatus === s ? "none" : "1.5px solid #e8edf3",
                background: filterStatus === s ? "#1a2744" : "white",
                color: filterStatus === s ? "white" : "#8896a5",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {properties.length === 0 && (
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
          ⚠️ Add a property first before creating bookings.
          <a
            href="/dashboard/properties"
            style={{ color: "#1a2744", fontWeight: 600, marginLeft: 8 }}
          >
            Go to Properties →
          </a>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
          Loading bookings...
        </div>
      ) : viewMode === "calendar" ? (
        // ── Calendar view ──────────────────────────────────────────────────
        <div
          style={{
            background: "white",
            borderRadius: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          {/* Calendar nav */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              borderBottom: "1px solid #e8edf3",
            }}
          >
            <button
              onClick={() =>
                setCalendarDate(new Date(calYear, calMonth - 1, 1))
              }
              style={{
                background: "none",
                border: "1.5px solid #e8edf3",
                borderRadius: 8,
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 14,
                color: "#1a2744",
                fontWeight: 600,
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1a2744" }}>
              {monthName}
            </span>
            <button
              onClick={() =>
                setCalendarDate(new Date(calYear, calMonth + 1, 1))
              }
              style={{
                background: "none",
                border: "1.5px solid #e8edf3",
                borderRadius: 8,
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 14,
                color: "#1a2744",
                fontWeight: 600,
              }}
            >
              Next →
            </button>
          </div>

          {/* Day headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid #e8edf3",
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                style={{
                  padding: "10px 0",
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#8896a5",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
          >
            {calDays.map((day, i) => {
              const dayBookings = day
                ? getBookingsForDay(calYear, calMonth, day)
                : [];
              const isToday =
                day !== null &&
                new Date().getDate() === day &&
                new Date().getMonth() === calMonth &&
                new Date().getFullYear() === calYear;
              return (
                <div
                  key={i}
                  style={{
                    minHeight: 90,
                    padding: "8px",
                    borderRight: "1px solid #f0f4f8",
                    borderBottom: "1px solid #f0f4f8",
                    background:
                      day === null ? "#fafafa" : isToday ? "#f0f9ff" : "white",
                  }}
                >
                  {day !== null && (
                    <>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: isToday ? 700 : 500,
                          color: isToday ? "#2cb5b0" : "#1a2744",
                          marginBottom: 4,
                        }}
                      >
                        {day}
                      </div>
                      {dayBookings.slice(0, 2).map((b) => (
                        <div
                          key={b.id}
                          title={`${b.guestName} · ${b.Property?.name}`}
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            marginBottom: 2,
                            background:
                              STATUS_COLORS[b.status]?.bg || "#e8edf3",
                            color: STATUS_COLORS[b.status]?.color || "#383d41",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {b.guestName.split(" ")[0]}
                        </div>
                      ))}
                      {dayBookings.length > 2 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "#8896a5",
                            fontWeight: 600,
                          }}
                        >
                          +{dayBookings.length - 2} more
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 16,
              padding: "16px 24px",
              borderTop: "1px solid #e8edf3",
              flexWrap: "wrap",
            }}
          >
            {Object.entries(STATUS_COLORS).map(([status, colors]) => (
              <div
                key={status}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: colors.bg,
                  }}
                />
                <span
                  style={{ fontSize: 11, color: "#8896a5", fontWeight: 600 }}
                >
                  {status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
          <h3 style={{ color: "#1a2744", marginBottom: 8 }}>
            No bookings found
          </h3>
          <p style={{ color: "#8896a5", fontSize: 14 }}>
            {filterStatus === "ALL"
              ? "Create your first booking to get started"
              : `No ${filterStatus.toLowerCase()} bookings`}
          </p>
        </div>
      ) : (
        // ── List view ──────────────────────────────────────────────────────
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filtered.map((b) => {
            const summary = paymentSummary(b.Payment);
            const isExpanded = expandedPayments === b.id;
            return (
              <div
                key={b.id}
                style={{
                  background: "white",
                  borderRadius: 16,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  padding: "20px 24px",
                  borderLeft: `4px solid ${
                    STATUS_COLORS[b.status]?.bg || "#e8edf3"
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
                  }}
                >
                  {/* Guest info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background:
                            "linear-gradient(135deg, #1a2744, #2cb5b0)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 700,
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {b.guestName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "#1a2744",
                            fontSize: 16,
                          }}
                        >
                          {b.guestName}
                        </div>
                        <div style={{ fontSize: 12, color: "#8896a5" }}>
                          {b.guestEmail || "No email"} · {b.guestCount} guest
                          {b.guestCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        flexWrap: "wrap",
                        marginTop: 8,
                      }}
                    >
                      {[
                        {
                          label: "Property",
                          val: `🏠 ${b.Property?.name || "—"}`,
                        },
                        {
                          label: "Check-in",
                          val: new Date(b.checkIn).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }),
                        },
                        {
                          label: "Check-out",
                          val: new Date(b.checkOut).toLocaleDateString(
                            "en-PH",
                            { month: "short", day: "numeric", year: "numeric" }
                          ),
                        },
                        {
                          label: "Nights",
                          val: String(nights(b.checkIn, b.checkOut)),
                        },
                        {
                          label: "Source",
                          val: `${SOURCE_ICONS[b.source]} ${b.source}`,
                        },
                      ].map((item) => (
                        <div key={item.label}>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#8896a5",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              marginBottom: 2,
                            }}
                          >
                            {item.label}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#1a2744",
                            }}
                          >
                            {item.val}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Payment summary */}
                    {b.Payment && b.Payment.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <button
                          onClick={() =>
                            setExpandedPayments(isExpanded ? null : b.id)
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: "#8896a5",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              Payments
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: "#155724",
                                background: "#d4edda",
                                borderRadius: 20,
                                padding: "2px 10px",
                                fontWeight: 600,
                              }}
                            >
                              Paid ₱
                              {summary.paid.toLocaleString("en-PH", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            {summary.balance > 0 && (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "#856404",
                                  background: "#fff3cd",
                                  borderRadius: 20,
                                  padding: "2px 10px",
                                  fontWeight: 600,
                                }}
                              >
                                Balance ₱
                                {summary.balance.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            )}
                            {summary.balance === 0 && summary.total > 0 && (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "#0c5460",
                                  background: "#d1ecf1",
                                  borderRadius: 20,
                                  padding: "2px 10px",
                                  fontWeight: 600,
                                }}
                              >
                                Fully paid ✓
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: "#8896a5" }}>
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </button>

                        {isExpanded && (
                          <div
                            style={{
                              marginTop: 10,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {b.Payment.map((p) => (
                              <div
                                key={p.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "8px 12px",
                                  background: "#f8fafc",
                                  borderRadius: 8,
                                }}
                              >
                                <div>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "#1a2744",
                                    }}
                                  >
                                    {p.type}
                                  </span>
                                  {p.paidAt && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: "#8896a5",
                                        marginLeft: 8,
                                      }}
                                    >
                                      {new Date(p.paidAt).toLocaleDateString(
                                        "en-PH",
                                        {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        }
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: "#1a2744",
                                    }}
                                  >
                                    ₱
                                    {Number(p.amount).toLocaleString("en-PH", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      padding: "2px 8px",
                                      borderRadius: 20,
                                      background:
                                        p.status === "PAID"
                                          ? "#d4edda"
                                          : "#fff3cd",
                                      color:
                                        p.status === "PAID"
                                          ? "#155724"
                                          : "#856404",
                                    }}
                                  >
                                    {p.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: STATUS_COLORS[b.status]?.bg,
                        color: STATUS_COLORS[b.status]?.color,
                      }}
                    >
                      {b.status.replace("_", " ")}
                    </span>
                    <select
                      value={b.status}
                      onChange={(e) => updateStatus(b.id, e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        border: "1.5px solid #e8edf3",
                        color: "#1a2744",
                        cursor: "pointer",
                        background: "white",
                        outline: "none",
                      }}
                    >
                      {[
                        "PENDING",
                        "CONFIRMED",
                        "CHECKED_IN",
                        "CHECKED_OUT",
                        "CANCELLED",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => openEdit(b)}
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
                        onClick={() => handleDelete(b.id)}
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
                </div>

                {b.notes && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "8px 12px",
                      background: "#f8fafc",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "#8896a5",
                      borderLeft: "3px solid #e8edf3",
                    }}
                  >
                    📝 {b.notes}
                  </div>
                )}
              </div>
            );
          })}
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
              maxWidth: 560,
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
                {editingId ? "Edit Booking" : "New Booking"}
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
              <div>
                <label style={fieldLabel}>Property *</label>
                <select
                  value={form.propertyId}
                  onChange={(e) =>
                    handleFormChange({ propertyId: e.target.value })
                  }
                  required
                  style={fieldInput}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
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
                  <label style={fieldLabel}>Guest Name *</label>
                  <input
                    type="text"
                    value={form.guestName}
                    onChange={(e) =>
                      handleFormChange({ guestName: e.target.value })
                    }
                    required
                    placeholder="Juan dela Cruz"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Guest Email</label>
                  <input
                    type="email"
                    value={form.guestEmail}
                    onChange={(e) =>
                      handleFormChange({ guestEmail: e.target.value })
                    }
                    placeholder="guest@email.com"
                    style={fieldInput}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={fieldLabel}>Check-in *</label>
                  <input
                    type="date"
                    value={form.checkIn}
                    onChange={(e) =>
                      handleFormChange({ checkIn: e.target.value })
                    }
                    required
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Check-out *</label>
                  <input
                    type="date"
                    value={form.checkOut}
                    onChange={(e) =>
                      handleFormChange({ checkOut: e.target.value })
                    }
                    required
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Guests</label>
                  <input
                    type="number"
                    min={1}
                    value={form.guestCount}
                    onChange={(e) =>
                      handleFormChange({ guestCount: Number(e.target.value) })
                    }
                    style={fieldInput}
                  />
                </div>
              </div>

              {/* Conflict warning — shows while typing dates */}
              {conflictWarning && (
                <div
                  style={{
                    background: "#fff3cd",
                    border: "1px solid #ffc107",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#856404",
                    fontWeight: 600,
                  }}
                >
                  {conflictWarning}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={fieldLabel}>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      handleFormChange({ status: e.target.value })
                    }
                    style={fieldInput}
                  >
                    {[
                      "PENDING",
                      "CONFIRMED",
                      "CHECKED_IN",
                      "CHECKED_OUT",
                      "CANCELLED",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Source</label>
                  <select
                    value={form.source}
                    onChange={(e) =>
                      handleFormChange({ source: e.target.value })
                    }
                    style={fieldInput}
                  >
                    {["DIRECT", "AIRBNB", "MANUAL"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={fieldLabel}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleFormChange({ notes: e.target.value })}
                  placeholder="Any special requests or notes..."
                  rows={3}
                  style={{ ...fieldInput, resize: "vertical" }}
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
                    : "Create Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
