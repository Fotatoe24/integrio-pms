"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Property {
  id: string;
  name: string;
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

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
          .select("*, Property(name)")
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
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

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

  const filtered =
    filterStatus === "ALL"
      ? bookings
      : bookings.filter((b) => b.status === filterStatus);

  function nights(checkIn: string, checkOut: string) {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }

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

      {/* Filter tabs */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}
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

      {/* No properties warning */}
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

      {/* Bookings list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
          Loading bookings...
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filtered.map((b) => (
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
                        background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
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
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#8896a5",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 2,
                        }}
                      >
                        Property
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1a2744",
                        }}
                      >
                        🏠 {b.Property?.name || "—"}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#8896a5",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 2,
                        }}
                      >
                        Check-in
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1a2744",
                        }}
                      >
                        {new Date(b.checkIn).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#8896a5",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 2,
                        }}
                      >
                        Check-out
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1a2744",
                        }}
                      >
                        {new Date(b.checkOut).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#8896a5",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 2,
                        }}
                      >
                        Nights
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1a2744",
                        }}
                      >
                        {nights(b.checkIn, b.checkOut)}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#8896a5",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 2,
                        }}
                      >
                        Source
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1a2744",
                        }}
                      >
                        {SOURCE_ICONS[b.source]} {b.source}
                      </div>
                    </div>
                  </div>
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
                  {/* Status badge */}
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

                  {/* Quick status update */}
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

                  {/* Actions */}
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
              {/* Property */}
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
                  Property *
                </label>
                <select
                  value={form.propertyId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, propertyId: e.target.value }))
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
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Guest name + email */}
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
                    Guest Name *
                  </label>
                  <input
                    type="text"
                    value={form.guestName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, guestName: e.target.value }))
                    }
                    required
                    placeholder="Juan dela Cruz"
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
                    Guest Email
                  </label>
                  <input
                    type="email"
                    value={form.guestEmail}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, guestEmail: e.target.value }))
                    }
                    placeholder="guest@email.com"
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

              {/* Dates + guests */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
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
                    Check-in *
                  </label>
                  <input
                    type="date"
                    value={form.checkIn}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, checkIn: e.target.value }))
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
                    }}
                  />
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
                    Check-out *
                  </label>
                  <input
                    type="date"
                    value={form.checkOut}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, checkOut: e.target.value }))
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
                    }}
                  />
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
                    Guests
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.guestCount}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        guestCount: Number(e.target.value),
                      }))
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

              {/* Status + Source */}
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
                    Source
                  </label>
                  <select
                    value={form.source}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, source: e.target.value }))
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
                    {["DIRECT", "AIRBNB", "MANUAL"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
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
                  placeholder="Any special requests or notes..."
                  rows={3}
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
