"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

interface Property {
  id: string;
  name: string;
}
interface Receiver {
  id: string;
  name: string;
}
interface Payment {
  id: string;
  type: string;
  amount: number;
  status: string;
  paidAt: string | null;
  method: string | null;
  receivedBy: string | null;
}
interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  guestEmail: string | null;
  guestCount: number;
  contactNo: string | null;
  bookedBy: string | null;
  platform: string | null;
  stayType: string | null;
  checkIn: string;
  checkOut: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursStayed: number | null;
  totalFee: number | null;
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

const PLATFORMS = ["Facebook", "TikTok", "Airbnb", "Direct", "Walk-in"];
const METHODS = ["Cash", "GCash", "Bank Transfer", "Maya"];

const RATES = {
  "Day (Short) 8AM-8PM": {
    hours: 12,
    checkIn: "8:00 AM",
    checkOut: "8:00 PM",
    weekday: 1499,
    weekend: 1699,
  },
  "Night (Short) 9PM-7AM": {
    hours: 10,
    checkIn: "9:00 PM",
    checkOut: "7:00 AM",
    weekday: 1199,
    weekend: 1299,
  },
  "Day (Long) 2PM-11AM": {
    hours: 21,
    checkIn: "2:00 PM",
    checkOut: "11:00 AM",
    weekday: 1699,
    weekend: 1899,
  },
  Custom: { hours: 0, checkIn: "", checkOut: "", weekday: 0, weekend: 0 },
};

function isWeekend(dateStr: string) {
  const day = new Date(dateStr).getDay();
  return day === 5 || day === 6 || day === 0;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterProperty, setFilterProperty] = useState("ALL");
  const [filterPayment, setFilterPayment] = useState("ALL");
  const [filterPlatform, setFilterPlatform] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedPayments, setExpandedPayments] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState("");
  const [nightCleaning, setNightCleaning] = useState(false);
  const [alternateUnits, setAlternateUnits] = useState<Property[]>([]);

  const [form, setForm] = useState({
    propertyId: "",
    guestName: "",
    guestEmail: "",
    contactNo: "",
    guestCount: 2,
    bookedBy: "",
    platform: "Facebook",
    stayType: "Day (Short) 8AM-8PM",
    checkIn: "",
    checkOut: "",
    checkInTime: "8:00 AM",
    checkOutTime: "8:00 PM",
    hoursStayed: 12,
    totalFee: 1499,
    status: "CONFIRMED",
    source: "DIRECT",
    notes: "",
    dpAmount: 0,
    dpDate: "",
    dpMethod: "Cash",
    dpReceivedBy: "",
    fpAmount: 0,
    fpDate: "",
    fpMethod: "Cash",
    fpReceivedBy: "",
    apAmount: 0,
    apDate: "",
    apMethod: "GCash",
    apReceivedBy: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const user = getCurrentUser();
    const ownerId = user?.owner_id ?? user?.id;

    const [
      { data: bookingsData },
      { data: propertiesData },
      { data: receiversData },
    ] = await Promise.all([
      supabase
        .from("Booking")
        .select(
          "*, Property(name), Payment(id, type, amount, status, paidAt, method, receivedBy)",
        )
        .order("checkIn", { ascending: false }),
      supabase.from("Property").select("id, name"),
      supabase
        .from("Receiver")
        .select("id, name")
        .eq("owner_id", ownerId ?? ""),
    ]);

    if (bookingsData) setBookings(bookingsData);
    if (propertiesData) setProperties(propertiesData);
    if (receiversData) setReceivers(receiversData);
    setLoading(false);
  }

  function parseDateTime(dateStr: string, timeStr: string | null): number {
    const date = new Date(dateStr);
    if (!timeStr) return date.getTime();

    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return date.getTime();

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  }

  function applyStayType(stayType: string, checkIn: string, checkOut: string) {
    const rate = RATES[stayType as keyof typeof RATES];
    if (!rate || stayType === "Custom") return {};
    if (!checkIn || !checkOut) {
      return {
        checkInTime: rate.checkIn,
        checkOutTime: rate.checkOut,
        hoursStayed: rate.hours,
        totalFee: rate.weekday,
      };
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nightsCount = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86400000),
    );

    // Sum the per-night rate for each night in the stay, respecting weekday/weekend pricing
    let totalFee = 0;
    for (let i = 0; i < nightsCount; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dayOfWeek = d.getDay();
      const weekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
      totalFee += weekend ? rate.weekend : rate.weekday;
    }

    return {
      checkInTime: rate.checkIn,
      checkOutTime: rate.checkOut,
      hoursStayed: rate.hours * nightsCount,
      totalFee,
    };
  }

  function handleFormChange(patch: Partial<typeof form>) {
    const updated = { ...form, ...patch };

    if (patch.stayType || patch.checkIn || patch.checkOut) {
      const rateFields = applyStayType(
        updated.stayType,
        updated.checkIn,
        updated.checkOut,
      );
      Object.assign(updated, rateFields);
    }

    setForm(updated);

    if (updated.propertyId && updated.checkIn && updated.checkOut) {
      // in handleFormChange
      const warning = checkConflict(
        updated.propertyId,
        updated.checkIn,
        updated.checkOut,
        updated.stayType,
        updated.checkInTime,
        updated.checkOutTime,
        editingId ?? undefined,
      );
      setConflictWarning(warning);

      const others = getAvailableUnits(
        updated.checkIn,
        updated.checkOut,
        updated.stayType,
        updated.checkInTime,
        updated.checkOutTime,
        editingId ?? undefined,
      ).filter((p) => p.id !== updated.propertyId);
      setAlternateUnits(others);
    }
  }

  function unitConflict(
    propertyId: string,
    checkIn: string,
    checkOut: string,
    newStayType: string,
    newCheckInTime: string,
    newCheckOutTime: string,
    excludeId?: string,
  ) {
    if (!propertyId || !checkIn || !checkOut) return "";
    const newIn = parseDateTime(checkIn, newCheckInTime);
    const newOut = parseDateTime(checkOut, newCheckOutTime);
    const newIsLong = newStayType.includes("Long");

    const overlapping = bookings.filter((b) => {
      if (b.id === excludeId) return false;
      if (b.propertyId !== propertyId) return false;
      if (b.status === "CANCELLED" || b.status === "CHECKED_OUT") return false;
      const bIn = parseDateTime(b.checkIn, b.checkInTime);
      const bOut = parseDateTime(b.checkOut, b.checkOutTime);
      return newIn < bOut && newOut > bIn;
    });

    if (overlapping.length === 0) return "";

    const existingHasLong = overlapping.some((b) =>
      (b.stayType || "").includes("Long"),
    );

    if (newIsLong || existingHasLong) {
      const conflict = overlapping[0];
      return `⚠️ Conflicts with ${conflict.guestName} (${new Date(
        conflict.checkIn,
      ).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      })} – ${new Date(conflict.checkOut).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      })})`;
    }

    if (overlapping.length >= 2) {
      return `⚠️ 2 short-stay bookings already exist for these dates`;
    }

    return "";
  }

  function checkConflict(
    propertyId: string,
    checkIn: string,
    checkOut: string,
    newStayType: string,
    newCheckInTime: string,
    newCheckOutTime: string,
    excludeId?: string,
  ) {
    if (!propertyId || !checkIn || !checkOut) return "";
    const newIn = parseDateTime(checkIn, newCheckInTime);
    const newOut = parseDateTime(checkOut, newCheckOutTime);
    const newIsLong = newStayType.includes("Long");

    const overlapping = bookings.filter((b) => {
      if (b.id === excludeId) return false;
      if (b.propertyId !== propertyId) return false;
      if (b.status === "CANCELLED" || b.status === "CHECKED_OUT") return false;
      const bIn = parseDateTime(b.checkIn, b.checkInTime);
      const bOut = parseDateTime(b.checkOut, b.checkOutTime);
      return newIn < bOut && newOut > bIn;
    });

    if (overlapping.length === 0) return "";

    const existingHasLong = overlapping.some((b) =>
      (b.stayType || "").includes("Long"),
    );

    if (newIsLong || existingHasLong) {
      const conflict = overlapping[0];
      return `⚠️ Fully booked — conflicts with ${
        conflict.guestName
      } (${new Date(conflict.checkIn).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      })} – ${new Date(conflict.checkOut).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      })})`;
    }

    if (overlapping.length >= 2) {
      return `⚠️ Fully booked — 2 short-stay bookings already exist for these dates`;
    }

    return "";
  }

  function getAvailableUnits(
    checkIn: string,
    checkOut: string,
    stayType: string,
    checkInTime: string,
    checkOutTime: string,
    excludeId?: string,
  ) {
    if (!checkIn || !checkOut) return [];
    return properties.filter(
      (p) =>
        unitConflict(
          p.id,
          checkIn,
          checkOut,
          stayType,
          checkInTime,
          checkOutTime,
          excludeId,
        ) === "",
    );
  }

  function openAdd() {
    const currentUser = getCurrentUser();
    setForm({
      propertyId: properties[0]?.id || "",
      guestName: "",
      guestEmail: "",
      contactNo: "",
      guestCount: 2,
      bookedBy: currentUser?.name || "",
      platform: "Facebook",
      stayType: "Day (Short) 8AM-8PM",
      checkIn: "",
      checkOut: "",
      checkInTime: "8:00 AM",
      checkOutTime: "8:00 PM",
      hoursStayed: 12,
      totalFee: 1499,
      status: "CONFIRMED",
      source: "DIRECT",
      notes: "",
      dpAmount: 0,
      dpDate: "",
      dpMethod: "Cash",
      dpReceivedBy: receivers[0]?.name || "",
      fpAmount: 0,
      fpDate: "",
      fpMethod: "Cash",
      fpReceivedBy: receivers[0]?.name || "",
      apAmount: 0,
      apDate: "",
      apMethod: "GCash",
      apReceivedBy: receivers[0]?.name || "",
    });
    setEditingId(null);
    setError("");
    setConflictWarning("");
    setNightCleaning(false);
    setShowForm(true);
  }

  function openEdit(b: Booking) {
    const dp = b.Payment?.find((p) => p.type === "DOWNPAYMENT");
    const fp = b.Payment?.find((p) => p.type === "FULL");
    const ap = b.Payment?.find((p) => p.type === "ADDITIONAL");
    setForm({
      propertyId: b.propertyId,
      guestName: b.guestName,
      guestEmail: b.guestEmail || "",
      contactNo: b.contactNo || "",
      guestCount: b.guestCount,
      bookedBy: b.bookedBy || "",
      platform: b.platform || "Facebook",
      stayType: b.stayType || "Day (Short) 8AM-8PM",
      checkIn: b.checkIn.split("T")[0],
      checkOut: b.checkOut.split("T")[0],
      checkInTime: b.checkInTime || "8:00 AM",
      checkOutTime: b.checkOutTime || "12:00 AM",
      hoursStayed: b.hoursStayed || 12,
      totalFee: b.totalFee || 0,
      status: b.status,
      source: b.source,
      notes: b.notes || "",
      dpAmount: dp ? Number(dp.amount) : 0,
      dpDate: dp?.paidAt?.split("T")[0] || "",
      dpMethod: dp?.method || "Cash",
      dpReceivedBy: dp?.receivedBy || receivers[0]?.name || "",
      fpAmount: fp ? Number(fp.amount) : 0,
      fpDate: fp?.paidAt?.split("T")[0] || "",
      fpMethod: fp?.method || "Cash",
      fpReceivedBy: fp?.receivedBy || receivers[0]?.name || "",
      apAmount: ap ? Number(ap.amount) : 0,
      apDate: ap?.paidAt?.split("T")[0] || "",
      apMethod: ap?.method || "GCash",
      apReceivedBy: ap?.receivedBy || receivers[0]?.name || "",
    });
    setEditingId(b.id);
    setError("");
    setConflictWarning("");
    setNightCleaning(false);
    setShowForm(true);
  }

  function buildTimestamp(dateStr: string, timeStr: string): string {
    const ms = parseDateTime(dateStr, timeStr);
    return new Date(ms).toISOString();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    // in handleSave
    // in handleSave
    const conflict = checkConflict(
      form.propertyId,
      form.checkIn,
      form.checkOut,
      form.stayType,
      form.checkInTime,
      form.checkOutTime,
      editingId ?? undefined,
    );
    if (conflict && form.status !== "CANCELLED") {
      setError(conflict);
      setSaving(false);
      return;
    }

    if (new Date(form.checkOut) < new Date(form.checkIn)) {
      setError("Check-out must be on or after check-in.");
      setSaving(false);
      return;
    }

    const bookingPayload = {
      propertyId: form.propertyId,
      guestName: form.guestName,
      guestEmail: form.guestEmail || null,
      contactNo: form.contactNo || null,
      guestCount: Number(form.guestCount),
      bookedBy: form.bookedBy || null,
      platform: form.platform || null,
      stayType: form.stayType || null,
      checkIn: buildTimestamp(form.checkIn, form.checkInTime),
      checkOut: buildTimestamp(form.checkOut, form.checkOutTime),
      checkInTime: form.checkInTime || null,
      checkOutTime: form.checkOutTime || null,
      hoursStayed: form.hoursStayed || null,
      totalFee: form.totalFee || 0,
      status: form.status,
      source: form.source,
      notes: form.notes || null,
    };

    let bookingId = editingId;

    if (editingId) {
      const { error } = await supabase
        .from("Booking")
        .update(bookingPayload)
        .eq("id", editingId);
      if (error) {
        const msg = error.message.includes("Booking conflict")
          ? "This unit was just booked for these dates by someone else. Please refresh and try again."
          : error.message;
        setError(msg);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("Booking")
        .insert(bookingPayload)
        .select()
        .single();
      if (error || !data) {
        setError(error?.message || "Failed to create booking");
        setSaving(false);
        return;
      }
      bookingId = data.id;
    }

    const paymentsToSave = [
      {
        type: "DOWNPAYMENT",
        amount: form.dpAmount,
        date: form.dpDate,
        method: form.dpMethod,
        receivedBy: form.dpReceivedBy,
      },
      {
        type: "FULL",
        amount: form.fpAmount,
        date: form.fpDate,
        method: form.fpMethod,
        receivedBy: form.fpReceivedBy,
      },
      {
        type: "ADDITIONAL",
        amount: form.apAmount,
        date: form.apDate,
        method: form.apMethod,
        receivedBy: form.apReceivedBy,
      },
    ];

    for (const p of paymentsToSave) {
      if (p.amount <= 0) continue;

      const { data: existing } = await supabase
        .from("Payment")
        .select("id")
        .eq("bookingId", bookingId!)
        .eq("type", p.type)
        .single();

      const payloadP = {
        bookingId: bookingId!,
        type: p.type,
        amount: p.amount,
        status: "PAID",
        paidAt: p.date
          ? new Date(p.date).toISOString()
          : new Date().toISOString(),
        method: p.method,
        receivedBy: p.receivedBy,
      };

      if (existing) {
        await supabase.from("Payment").update(payloadP).eq("id", existing.id);
      } else {
        await supabase.from("Payment").insert(payloadP);
      }
    }

    if (nightCleaning && bookingId) {
      const user = getCurrentUser();
      const ownerId = user?.owner_id ?? user?.id;
      await supabase.from("ExpenseNote").insert({
        owner_id: ownerId,
        created_by: user?.id,
        content: `Night cleaning — ${
          bookings.find((b) => b.id === bookingId)?.guestName || form.guestName
        } (${form.checkIn})`,
        category: "cleaning",
        amount: 300,
      });
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this booking?")) return;
    const { error } = await supabase.from("Booking").delete().eq("id", id);
    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }
    loadData();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("Booking").update({ status }).eq("id", id);
    loadData();
  }

  function nights(checkIn: string, checkOut: string) {
    return Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
    );
  }

  function getPaymentState(b: Booking) {
    const paid = (b.Payment || [])
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + Number(p.amount), 0);
    const total = b.totalFee || 0;
    if (paid <= 0) return "UNPAID";
    if (paid >= total && total > 0) return "FULLY_PAID";
    return "PARTIAL";
  }

  const upcomingForProperty = bookings
    .filter(
      (b) =>
        b.propertyId === form.propertyId &&
        b.status !== "CANCELLED" &&
        b.id !== editingId,
    )
    .filter((b) => new Date(b.checkOut) >= new Date())
    .sort(
      (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime(),
    )
    .slice(0, 5);

  const filtered = bookings.filter((b) => {
    if (filterStatus !== "ALL" && b.status !== filterStatus) return false;
    if (filterProperty !== "ALL" && b.propertyId !== filterProperty)
      return false;
    if (filterPayment !== "ALL" && getPaymentState(b) !== filterPayment)
      return false;
    if (filterPlatform !== "ALL" && b.platform !== filterPlatform) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchesName = b.guestName.toLowerCase().includes(q);
      const matchesContact = (b.contactNo || "").toLowerCase().includes(q);
      const matchesEmail = (b.guestEmail || "").toLowerCase().includes(q);
      if (!matchesName && !matchesContact && !matchesEmail) return false;
    }
    return true;
  });

  const totalPaid =
    (form.dpAmount || 0) + (form.fpAmount || 0) + (form.apAmount || 0);
  const remainingBalance = (form.totalFee || 0) - totalPaid;
  const isFullyPaid = remainingBalance <= 0;

  const fieldLabel: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--brand-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  };
  const fieldInput: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px solid var(--brand-border)",
    borderRadius: 10,
    fontSize: 14,
    color: "var(--brand-text)",
    outline: "none",
    background: "var(--background)",
    fontFamily: "inherit",
  };
  const sectionTitle = (color: string, label: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
    </div>
  );

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
            Bookings
          </h1>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            href="/dashboard/calendar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              border: "1.5px solid var(--brand-border)",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--brand-text)",
              background: "var(--background)",
              textDecoration: "none",
            }}
          >
            📅 View Calendar
          </a>
          <button
            onClick={openAdd}
            disabled={properties.length === 0}
            style={{
              background:
                "linear-gradient(135deg, var(--brand-accent-dark), var(--brand-accent))",
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

      {/* Filter bar + status tabs (list view only) */}
      <>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Search */}
          <div
            style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, contact, or email..."
              style={{
                width: "100%",
                padding: "9px 14px 9px 34px",
                border: "1.5px solid var(--brand-border)",
                borderRadius: 10,
                fontSize: 13,
                color: "var(--brand-text)",
                outline: "none",
                background: "var(--background)",
                fontFamily: "inherit",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                color: "var(--brand-text-muted)",
              }}
            >
              🔍
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--brand-text-muted)",
                  fontSize: 14,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Unit filter */}
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            style={{
              padding: "9px 12px",
              border: "1.5px solid var(--brand-border)",
              borderRadius: 10,
              fontSize: 13,
              color: "var(--brand-text)",
              background: "var(--background)",
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <option value="ALL">All Units</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Payment filter */}
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            style={{
              padding: "9px 12px",
              border: "1.5px solid var(--brand-border)",
              borderRadius: 10,
              fontSize: 13,
              color: "var(--brand-text)",
              background: "var(--background)",
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <option value="ALL">All Payments</option>
            <option value="FULLY_PAID">Fully Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          {/* Platform filter */}
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            style={{
              padding: "9px 12px",
              border: "1.5px solid var(--brand-border)",
              borderRadius: 10,
              fontSize: 13,
              color: "var(--brand-text)",
              background: "var(--background)",
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <option value="ALL">All Platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Clear filters */}
          {(filterProperty !== "ALL" ||
            filterPayment !== "ALL" ||
            searchQuery ||
            filterStatus !== "ALL") && (
            <button
              onClick={() => {
                setFilterProperty("ALL");
                setFilterPayment("ALL");
                setFilterPlatform("ALL");
                setSearchQuery("");
                setFilterStatus("ALL");
              }}
              style={{
                padding: "9px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: "1.5px solid #fecaca",
                background: "#fef2f2",
                color: "#e74c3c",
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Status tabs */}
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
                border:
                  filterStatus === s
                    ? "none"
                    : "1.5px solid var(--brand-border)",
                background:
                  filterStatus === s
                    ? "var(--brand-text)"
                    : "var(--background)",
                color:
                  filterStatus === s
                    ? "var(--background)"
                    : "var(--brand-text-muted)",
                cursor: "pointer",
              }}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </>

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
          ⚠️ Add a property first.
          <a
            href="/dashboard/properties"
            style={{
              color: "var(--brand-text)",
              fontWeight: 600,
              marginLeft: 8,
            }}
          >
            Go to Properties →
          </a>
        </div>
      )}

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--brand-text-muted)",
          }}
        >
          Loading bookings...
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: "var(--background)",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
          <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
            No bookings found
          </h3>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filtered.map((b) => {
            const payments = b.Payment || [];
            const totalPaidB = payments
              .filter((p) => p.status === "PAID")
              .reduce((s, p) => s + Number(p.amount), 0);
            const balanceB = (b.totalFee || 0) - totalPaidB;
            const isExpanded = expandedPayments === b.id;
            return (
              <div
                key={b.id}
                style={{
                  background: "var(--popover)",
                  borderRadius: 16,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  padding: "20px 24px",
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
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background:
                            "linear-gradient(135deg, var(--brand-accent-dark), var(--brand-accent))",
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
                            color: "var(--brand-text)",
                            fontSize: 16,
                          }}
                        >
                          {b.guestName}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--brand-text-muted)",
                          }}
                        >
                          {b.contactNo || b.guestEmail || "No contact"} ·{" "}
                          {b.guestCount} guest{b.guestCount !== 1 ? "s" : ""}
                          {b.platform && (
                            <span style={{ marginLeft: 6 }}>
                              · 📲 {b.platform}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        flexWrap: "wrap",
                        marginTop: 4,
                      }}
                    >
                      {[
                        {
                          label: "Property",
                          val: `🏠 ${b.Property?.name || "—"}`,
                        },
                        {
                          label: "Check-in",
                          val: `${new Date(b.checkIn).toLocaleDateString(
                            "en-PH",
                            { month: "short", day: "numeric", year: "numeric" },
                          )} ${b.checkInTime || ""}`,
                        },
                        {
                          label: "Check-out",
                          val: `${new Date(b.checkOut).toLocaleDateString(
                            "en-PH",
                            { month: "short", day: "numeric", year: "numeric" },
                          )} ${b.checkOutTime || ""}`,
                        },
                        {
                          label: "Hours",
                          val: b.hoursStayed
                            ? `${b.hoursStayed}hrs`
                            : `${nights(b.checkIn, b.checkOut)}N`,
                        },
                        {
                          label: "Source",
                          val: `${SOURCE_ICONS[b.source] || "📲"} ${
                            b.platform || b.source
                          }`,
                        },
                        {
                          label: "Total Fee",
                          val: b.totalFee
                            ? `₱${Number(b.totalFee).toLocaleString("en-PH")}`
                            : "—",
                        },
                      ].map((item) => (
                        <div key={item.label}>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--brand-text-muted)",
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
                              color: "var(--brand-text)",
                            }}
                          >
                            {item.val}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Payment summary */}
                    {payments.length > 0 && (
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
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--brand-text-muted)",
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
                              {totalPaidB.toLocaleString("en-PH", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            {balanceB > 0 && (
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
                                {balanceB.toLocaleString("en-PH", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            )}
                            {balanceB <= 0 && (
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
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--brand-text-muted)",
                              }}
                            >
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div
                            style={{
                              marginTop: 8,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {payments.map((p) => (
                              <div
                                key={p.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "8px 12px",
                                  background: "var(--brand-bg)",
                                  borderRadius: 8,
                                }}
                              >
                                <div>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: "var(--brand-text)",
                                    }}
                                  >
                                    {p.type}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "var(--brand-text-muted)",
                                      marginLeft: 8,
                                    }}
                                  >
                                    {p.method}
                                  </span>
                                  {p.receivedBy && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: "var(--brand-text-muted)",
                                        marginLeft: 8,
                                      }}
                                    >
                                      → {p.receivedBy}
                                    </span>
                                  )}
                                  {p.paidAt && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        color: "var(--brand-text-muted)",
                                        marginLeft: 8,
                                      }}
                                    >
                                      {new Date(p.paidAt).toLocaleDateString(
                                        "en-PH",
                                        {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        },
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: "var(--brand-text)",
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
                        border: "1.5px solid var(--brand-border)",
                        color: "var(--brand-text)",
                        cursor: "pointer",
                        background: "var(--background)",
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
                          border: "1.5px solid var(--brand-border)",
                          background: "var(--background)",
                          color: "var(--brand-text)",
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
                      background: "var(--brand-bg)",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "var(--brand-text-muted)",
                      borderLeft: "3px solid var(--brand-border)",
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

      {/* ── BOOKING MODAL ── */}
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
              background: "var(--background)",
              borderRadius: 20,
              width: "100%",
              maxWidth: 640,
              margin: "auto",
              boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "24px 28px",
                borderBottom: "1px solid var(--brand-border)",
                position: "sticky",
                top: 0,
                background: "var(--background)",
                zIndex: 10,
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--brand-text)",
                  }}
                >
                  {editingId ? "Edit Booking" : "New Booking"}
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--brand-text-muted)",
                    marginTop: 2,
                  }}
                >
                  Update booking details
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  background: "var(--brand-bg)",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 18,
                  color: "var(--brand-text-muted)",
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
              style={{
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Guest info */}
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={fieldLabel}>Contact No.</label>
                  <input
                    type="text"
                    value={form.contactNo}
                    onChange={(e) =>
                      handleFormChange({ contactNo: e.target.value })
                    }
                    placeholder="09XXXXXXXXX"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Unit *</label>
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
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={fieldLabel}>
                    Booked By (Who got this booking)
                  </label>
                  <input
                    type="text"
                    value={form.bookedBy}
                    onChange={(e) =>
                      handleFormChange({ bookedBy: e.target.value })
                    }
                    placeholder="Staff name"
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>
                    Platform (Where it came from)
                  </label>
                  <select
                    value={form.platform}
                    onChange={(e) =>
                      handleFormChange({ platform: e.target.value })
                    }
                    style={fieldInput}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mini calendar — upcoming bookings for selected unit */}
              {form.propertyId && upcomingForProperty.length > 0 && (
                <div
                  style={{
                    background: "var(--brand-bg)",
                    borderRadius: 12,
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--brand-accent)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 10,
                    }}
                  >
                    Selected Unit Calendar — Upcoming dates for{" "}
                    {properties.find((p) => p.id === form.propertyId)?.name}
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {upcomingForProperty.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "var(--background)",
                          borderRadius: 8,
                          border: "1px solid var(--brand-border)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <span style={{ fontSize: 13 }}>📅</span>
                          <div>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--brand-text)",
                              }}
                            >
                              {new Date(b.checkIn).toLocaleDateString("en-PH", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              →{" "}
                              {new Date(b.checkOut).toLocaleDateString(
                                "en-PH",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </span>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--brand-text-muted)",
                              }}
                            >
                              {b.checkInTime && `In ${b.checkInTime}`}{" "}
                              {b.checkOutTime && `· Out ${b.checkOutTime}`}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--brand-text)",
                            }}
                          >
                            {b.guestName}
                          </span>
                          {b.Payment && b.Payment.length > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 20,
                                background: "#fff3cd",
                                color: "#856404",
                              }}
                            >
                              DP Paid
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflict warning */}
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

              {alternateUnits.length > 0 && (
  <div
    style={{
      background: "#eef9f4",
      border: "1px solid #b7e4c7",
      borderRadius: 8,
      padding: "12px 14px",
    }}
  >
    <div style={{ fontSize: 12, fontWeight: 700, color: "#1b7a4a", marginBottom: 8 }}>
      {conflictWarning
        ? "This unit is booked — other units free for these dates:"
        : "Also available for these dates:"}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {alternateUnits.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => handleFormChange({ propertyId: p.id })}
          style={{
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            border: "1.5px solid #b7e4c7",
            background: "var(--background)",
            color: "#1b7a4a",
            cursor: "pointer",
          }}
        >
          {p.name} →
        </button>
      ))}
    </div>
  </div>
)}

              {/* No conflict indicator */}
              {!conflictWarning && form.checkIn && form.checkOut && (
                <div
                  style={{
                    background: "#d4edda",
                    border: "1px solid #c3e6cb",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#155724",
                    fontWeight: 600,
                  }}
                >
                  ✅ Unit is available — no conflicts
                </div>
              )}

              {/* Stay type */}
              <div>
                <label style={fieldLabel}>Stay Type</label>
                <select
                  value={form.stayType}
                  onChange={(e) =>
                    handleFormChange({ stayType: e.target.value })
                  }
                  style={fieldInput}
                >
                  {Object.keys(RATES).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={fieldLabel}>Check-in Date *</label>
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
                  <label style={fieldLabel}>Check-in Time</label>
                  <input
                    type="text"
                    value={form.checkInTime}
                    onChange={(e) =>
                      handleFormChange({ checkInTime: e.target.value })
                    }
                    placeholder="8:00 AM"
                    style={fieldInput}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={fieldLabel}>Check-out Date *</label>
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
                  <label style={fieldLabel}>Check-out Time</label>
                  <input
                    type="text"
                    value={form.checkOutTime}
                    onChange={(e) =>
                      handleFormChange({ checkOutTime: e.target.value })
                    }
                    placeholder="8:00 PM"
                    style={fieldInput}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label style={fieldLabel}>Hours Stayed</label>
                  <input
                    type="number"
                    value={form.hoursStayed}
                    onChange={(e) =>
                      handleFormChange({ hoursStayed: Number(e.target.value) })
                    }
                    style={fieldInput}
                  />
                </div>
                <div>
                  <label style={fieldLabel}>Total Fee (₱) *</label>
                  <input
                    type="number"
                    value={form.totalFee}
                    onChange={(e) =>
                      handleFormChange({ totalFee: Number(e.target.value) })
                    }
                    required
                    style={{ ...fieldInput, fontWeight: 700, fontSize: 16 }}
                  />
                </div>
              </div>

              {/* Downpayment */}
              <div
                style={{
                  background: "var(--brand-bg)",
                  borderRadius: 12,
                  padding: "16px",
                }}
              >
                {sectionTitle("#22c55e", "Down Payment")}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={fieldLabel}>Amount (₱)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.dpAmount || ""}
                      onChange={(e) =>
                        handleFormChange({ dpAmount: Number(e.target.value) })
                      }
                      placeholder="0"
                      style={fieldInput}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Date</label>
                    <input
                      type="date"
                      value={form.dpDate}
                      onChange={(e) =>
                        handleFormChange({ dpDate: e.target.value })
                      }
                      style={fieldInput}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Method</label>
                    <select
                      value={form.dpMethod}
                      onChange={(e) =>
                        handleFormChange({ dpMethod: e.target.value })
                      }
                      style={fieldInput}
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabel}>Received By</label>
                    <select
                      value={form.dpReceivedBy}
                      onChange={(e) =>
                        handleFormChange({ dpReceivedBy: e.target.value })
                      }
                      style={fieldInput}
                    >
                      <option value="">— Select —</option>
                      {receivers.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Full payment */}
              <div
                style={{
                  background: "#f0f9ff",
                  borderRadius: 12,
                  padding: "16px",
                }}
              >
                {sectionTitle("#3b82f6", "Full Payment")}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={fieldLabel}>Amount (₱)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.fpAmount || ""}
                      onChange={(e) =>
                        handleFormChange({ fpAmount: Number(e.target.value) })
                      }
                      placeholder="0"
                      style={fieldInput}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Date</label>
                    <input
                      type="date"
                      value={form.fpDate}
                      onChange={(e) =>
                        handleFormChange({ fpDate: e.target.value })
                      }
                      style={fieldInput}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Method</label>
                    <select
                      value={form.fpMethod}
                      onChange={(e) =>
                        handleFormChange({ fpMethod: e.target.value })
                      }
                      style={fieldInput}
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabel}>Received By</label>
                    <select
                      value={form.fpReceivedBy}
                      onChange={(e) =>
                        handleFormChange({ fpReceivedBy: e.target.value })
                      }
                      style={fieldInput}
                    >
                      <option value="">— Select —</option>
                      {receivers.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional payment */}
              <div
                style={{
                  background: "#fdf4ff",
                  borderRadius: 12,
                  padding: "16px",
                }}
              >
                {sectionTitle("#a855f7", "Additional Payment")}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={fieldLabel}>Amount (₱)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.apAmount || ""}
                      onChange={(e) =>
                        handleFormChange({ apAmount: Number(e.target.value) })
                      }
                      placeholder="0"
                      style={fieldInput}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Date</label>
                    <input
                      type="date"
                      value={form.apDate}
                      onChange={(e) =>
                        handleFormChange({ apDate: e.target.value })
                      }
                      style={fieldInput}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Method</label>
                    <select
                      value={form.apMethod}
                      onChange={(e) =>
                        handleFormChange({ apMethod: e.target.value })
                      }
                      style={fieldInput}
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabel}>Received By</label>
                    <select
                      value={form.apReceivedBy}
                      onChange={(e) =>
                        handleFormChange({ apReceivedBy: e.target.value })
                      }
                      style={fieldInput}
                    >
                      <option value="">— Select —</option>
                      {receivers.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Remaining balance */}
              <div
                style={{
                  background: isFullyPaid ? "#d4edda" : "#fff3cd",
                  borderRadius: 12,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isFullyPaid ? "#155724" : "#856404",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                  >
                    Remaining Balance
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: isFullyPaid ? "#155724" : "#856404",
                    }}
                  >
                    ₱
                    {Math.max(0, remainingBalance).toLocaleString("en-PH", {
                      minimumFractionDigits: 0,
                    })}
                  </div>
                </div>
                {isFullyPaid && (
                  <div
                    style={{
                      background: "#22c55e",
                      color: "white",
                      borderRadius: 20,
                      padding: "8px 20px",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    Fully Paid ✓
                  </div>
                )}
              </div>

              {/* Night cleaning */}
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <input
                  type="checkbox"
                  id="nightCleaning"
                  checked={nightCleaning}
                  onChange={(e) => setNightCleaning(e.target.checked)}
                  style={{
                    marginTop: 2,
                    width: 16,
                    height: 16,
                    cursor: "pointer",
                    accentColor: "#f59e0b",
                  }}
                />
                <label htmlFor="nightCleaning" style={{ cursor: "pointer" }}>
                  <div
                    style={{ fontSize: 14, fontWeight: 600, color: "#92400e" }}
                  >
                    Night Cleaning
                  </div>
                  <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>
                    Adds a ₱300 Clean Night expense to Finances after saving.
                  </div>
                </label>
              </div>

              {/* Status + source + notes */}
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

              <div>
                <label style={fieldLabel}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleFormChange({ notes: e.target.value })}
                  placeholder="Any special requests or notes..."
                  rows={2}
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

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12, paddingTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "1.5px solid var(--brand-border)",
                    borderRadius: 10,
                    background: "var(--background)",
                    color: "var(--brand-text-muted)",
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
                    background:
                      "linear-gradient(135deg, var(--brand-accent-dark), var(--brand-accent))",
                    border: "none",
                    borderRadius: 10,
                    color: "white",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: saving ? 0.7 : 1,
                    boxShadow: "0 4px 16px rgba(44,181,176,0.3)",
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Booking"
                      : "Create Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        * { 
        box-sizing: border-box; 
        margin: 0; 
        padding: 0; 
        }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        select option { background: var(--background); color: var(--brand-text); }
      `}</style>
    </div>
  );
}
