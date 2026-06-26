"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRole, IntegrioUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import UnitCalendar from "@/components/ui/UnitCalendar";

type Tab =
  | "Overview"
  | "Employees"
  | "Receivers"
  | "Expenses"
  | "Payments"
  | "Bookings"
  | "Calendar";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  invited_at: string | null;
}

interface ExpenseNote {
  id: string;
  content: string;
  category: string;
  amount: number;
  createdAt: string;
  created_by: string;
}

interface Payment {
  id: string;
  bookingId: string;
  type: string;
  amount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  Booking?: { guestName: string; Property?: { name: string } };
}

interface Receiver {
  id: string;
  name: string;
  owner_id: string;
  createdAt: string;
}

interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  contactNo: string | null;
  platform: string | null;
  checkIn: string;
  checkOut: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  stayType: string | null;
  totalFee: number | null;
  status: string;
  source: string;
  Property?: { name: string };
  Payment?: Payment[];
}

interface Property {
  id: string;
  name: string;
}

const ROLES = ["booker", "auditor", "housekeeping"];

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  booker: { bg: "#d1ecf1", color: "#0c5460" },
  auditor: { bg: "#fff3cd", color: "#856404" },
  housekeeping: { bg: "#d4edda", color: "#155724" },
  owner: { bg: "#e8d5f5", color: "#5a2d82" },
  ADMIN: { bg: "#e8d5f5", color: "#5a2d82" },
  STAFF: { bg: "#d1ecf1", color: "#0c5460" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: "#d4edda", color: "#155724" },
  invited: { bg: "#fff3cd", color: "#856404" },
  revoked: { bg: "#f8d7da", color: "#721c24" },
  PENDING: { bg: "#fff3cd", color: "#856404" },
  CONFIRMED: { bg: "#d1ecf1", color: "#0c5460" },
  CHECKED_IN: { bg: "#d4edda", color: "#155724" },
  CHECKED_OUT: { bg: "#e2e3e5", color: "#383d41" },
  CANCELLED: { bg: "#f8d7da", color: "#721c24" },
  PAID: { bg: "#d4edda", color: "#155724" },
  PARTIAL: { bg: "#fff3cd", color: "#856404" },
  REFUNDED: { bg: "#f8d7da", color: "#721c24" },
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  general: { bg: "#e2e3e5", color: "#383d41" },
  cleaning: { bg: "#d1ecf1", color: "#0c5460" },
  supplies: { bg: "#fff3cd", color: "#856404" },
  maintenance: { bg: "#f8d7da", color: "#721c24" },
  laundry: { bg: "#d4edda", color: "#155724" },
  other: { bg: "#e8d5f5", color: "#5a2d82" },
};

export default function OwnerPage() {
  const router = useRouter();
  const [user, setUser] = useState<IntegrioUser | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenseNotes, setExpenseNotes] = useState<ExpenseNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("booker");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const [receivers, setReceivers] = useState<Receiver[]>([]);
  const [newReceiverName, setNewReceiverName] = useState("");
  const [addingReceiver, setAddingReceiver] = useState(false);

  // Booking filters
  const [filterProperty, setFilterProperty] = useState("ALL");
  const [filterPlatform, setFilterPlatform] = useState("ALL");
  const [filterBookingStatus, setFilterBookingStatus] = useState("ALL");
  const [filterPaymentState, setFilterPaymentState] = useState("ALL");
  const [bookingSearch, setBookingSearch] = useState("");

  useEffect(() => {
    document.title = "Owner — Integrio";
    const u = requireRole(["owner", "ADMIN"], router);
    if (u) {
      setUser(u);
      loadAll(u);
    }
  }, []);

  async function loadAll(u: IntegrioUser) {
    setLoading(true);
    const ownerId = u.id;

    // Step 1 — get owner's properties first
    const { data: props } = await supabase
      .from("Property")
      .select("id, name")
      .eq("owner_id", ownerId);

    const propertyIds = (props ?? []).map((p) => p.id);
    setProperties(props ?? []);

    // Step 2 — get bookings only for those properties
    const { data: book } =
      propertyIds.length > 0
        ? await supabase
            .from("Booking")
            .select(
              "*, Property(name), Payment(id, type, amount, status, paidAt)"
            )
            .in("propertyId", propertyIds)
            .order("checkIn", { ascending: false })
        : { data: [] };

    // Step 3 — get payments only for those bookings
    const bookingIds = (book ?? []).map((b) => b.id);
    const { data: pay } =
      bookingIds.length > 0
        ? await supabase
            .from("Payment")
            .select("*, Booking(guestName, Property(name))")
            .in("bookingId", bookingIds)
            .order("createdAt", { ascending: false })
        : { data: [] };

    // Step 4 — employees and expenses (already scoped by owner_id)
    const [{ data: emp }, { data: exp }] = await Promise.all([
      supabase
        .from("User")
        .select(
          "id, name, email, role, status, createdAt, invited_at, temp_password"
        )
        .eq("owner_id", ownerId)
        .order("createdAt", { ascending: false }),
      supabase
        .from("ExpenseNote")
        .select("*")
        .eq("owner_id", ownerId)
        .order("createdAt", { ascending: false }),
    ]);

    const { data: rec } = await supabase
      .from("Receiver")
      .select("*")
      .eq("owner_id", ownerId)
      .order("createdAt", { ascending: true });

    if (rec) setReceivers(rec);
    if (emp) setEmployees(emp);
    if (exp) setExpenseNotes(exp);
    if (pay) setPayments(pay);
    if (book) setBookings(book);
    setLoading(false);
  }

  async function handleAddReceiver() {
    if (!newReceiverName.trim() || !user) return;
    setAddingReceiver(true);
    const { data, error } = await supabase
      .from("Receiver")
      .insert({ owner_id: user.id, name: newReceiverName.trim() })
      .select()
      .single();
    if (!error && data) {
      setReceivers((prev) => [...prev, data]);
      setNewReceiverName("");
    }
    setAddingReceiver(false);
  }

  async function handleRemoveReceiver(id: string) {
    if (!confirm("Remove this receiver?")) return;
    const { error } = await supabase.from("Receiver").delete().eq("id", id);
    if (!error) setReceivers((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim() || !user) return;
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      const res = await fetch("/api/invite-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          ownerId: user.id,
          ownerName: user.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error || "Failed to send invite.");
      } else {
        setInviteSuccess(`Invite sent to ${inviteEmail}`);
        setInviteName("");
        setInviteEmail("");
        setInviteRole("booker");
        loadAll(user);
        setTimeout(() => {
          setShowInviteForm(false);
          setInviteSuccess("");
        }, 2000);
      }
    } catch {
      setInviteError("Something went wrong. Please try again.");
    }
    setInviting(false);
  }

  async function handleRevoke(emp: Employee) {
    if (
      !confirm(
        `Revoke access for ${emp.name}? They will no longer be able to log in.`
      )
    )
      return;
    const { error } = await supabase
      .from("User")
      .update({ status: "revoked" })
      .eq("id", emp.id);
    if (!error)
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, status: "revoked" } : e))
      );
  }

  async function handleReactivate(emp: Employee) {
    const { error } = await supabase
      .from("User")
      .update({ status: "active" })
      .eq("id", emp.id);
    if (!error)
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, status: "active" } : e))
      );
  }

  async function handleRemove(emp: Employee) {
    if (!confirm(`Permanently remove ${emp.name}? This cannot be undone.`))
      return;
    const { error } = await supabase.from("User").delete().eq("id", emp.id);
    if (!error) setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function logout() {
    localStorage.removeItem("integrio_user");
    document.cookie = "auth-token=; max-age=0; path=/";
    window.location.href = "/login";
  }

  function nights(a: string, b: string) {
    return Math.round(
      (new Date(b).getTime() - new Date(a).getTime()) / 86400000
    );
  }

  // Stats
  const totalIncome = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = expenseNotes.reduce((s, n) => s + Number(n.amount), 0);
  const pendingCollection = payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + Number(p.amount), 0);
  const netIncome = totalIncome - totalExpenses;
  const activeBookings = bookings.filter(
    (b) => b.status === "CHECKED_IN"
  ).length;

  // Collected revenue = sum of DOWNPAYMENT + FULL payments (PAID)
  const collectedRevenue = bookings.reduce((sum, b) => {
    const paid = (b.Payment || [])
      .filter(
        (p) =>
          p.status === "PAID" && (p.type === "DOWNPAYMENT" || p.type === "FULL")
      )
      .reduce((s, p) => s + Number(p.amount), 0);
    return sum + paid;
  }, 0);

  // Expected revenue = sum of totalFee across all bookings (excluding cancelled)
  const expectedRevenue = bookings
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => sum + Number(b.totalFee || 0), 0);

  // Payment status per booking
  function getBookingPaymentState(b: Booking) {
    const paid = (b.Payment || [])
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + Number(p.amount), 0);
    const total = b.totalFee || 0;
    if (paid <= 0) return "UNPAID";
    if (paid >= total && total > 0) return "FULLY_PAID";
    return "PARTIAL";
  }

  const fullyPaidCount = bookings.filter(
    (b) =>
      b.status !== "CANCELLED" && getBookingPaymentState(b) === "FULLY_PAID"
  ).length;
  const notFullyPaidCount = bookings.filter(
    (b) =>
      b.status !== "CANCELLED" && getBookingPaymentState(b) !== "FULLY_PAID"
  ).length;

  // Bookings whose check-in falls in the current calendar month
  const now = new Date();
  const bookingsThisMonth = bookings.filter((b) => {
    const d = new Date(b.checkIn);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;

  // % of expected revenue collected so far
  const collectionPct =
    expectedRevenue > 0
      ? Math.min(100, Math.round((collectedRevenue / expectedRevenue) * 100))
      : 0;

  // Filtered bookings for the Bookings tab
  const filteredBookings = bookings.filter((b) => {
    if (filterBookingStatus !== "ALL" && b.status !== filterBookingStatus)
      return false;
    if (filterProperty !== "ALL" && b.propertyId !== filterProperty)
      return false;
    if (filterPlatform !== "ALL" && b.platform !== filterPlatform) return false;
    if (
      filterPaymentState !== "ALL" &&
      getBookingPaymentState(b) !== filterPaymentState
    )
      return false;
    if (bookingSearch.trim()) {
      const q = bookingSearch.trim().toLowerCase();
      const matchesName = b.guestName.toLowerCase().includes(q);
      const matchesContact = (b.contactNo || "").toLowerCase().includes(q);
      if (!matchesName && !matchesContact) return false;
    }
    return true;
  });
  const TABS: Tab[] = [
    "Overview",
    "Employees",
    "Receivers",
    "Expenses",
    "Payments",
    "Bookings",
    "Calendar",
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid #23232b",
    borderRadius: 10,
    fontSize: 14,
    color: "#f5f5f7",
    outline: "none",
    fontFamily: "inherit",
    background: "#15151a",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#9a9aa5",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  };

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0c",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#0a0a0c",
          borderBottom: "1px solid #1c1c22",
          padding: "0 32px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Logo */}
          <img
            src="./darktrans.png"
            alt="Integrio"
            className="w-20 sm:w-20 h-auto"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}
          />

          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              background: "#1c1c22",
              color: "#c7c7cf",
              border: "1px solid #2a2a33",
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            Owner
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "#9a9aa5" }}>{user.name}</span>

          <a
            href="/change-password"
            style={{
              fontSize: 13,
              color: "#9a9aa5",
              border: "1.5px solid #23232b",
              borderRadius: 8,
              padding: "6px 14px",
              textDecoration: "none",
            }}
          >
            Change password
          </a>
          <button
            onClick={logout}
            style={{
              fontSize: 13,
              color: "#9a9aa5",
              background: "none",
              border: "1.5px solid #23232b",
              borderRadius: 8,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div
        style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px 80px" }}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#f5f5f7",
                marginBottom: 4,
              }}
            >
              Owner Dashboard
            </h1>
            <p style={{ color: "#9a9aa5", fontSize: 14 }}>
              Full visibility across all operations
            </p>
          </div>
          {activeTab === "Employees" && (
            <button
              onClick={() => {
                setShowInviteForm(true);
                setInviteError("");
                setInviteSuccess("");
              }}
              style={{
                background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 16px rgba(44,181,176,0.3)",
              }}
            >
              <span style={{ fontSize: 18 }}>+</span> Invite Employee
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#9a9aa5" }}>
            Loading...
          </div>
        ) : (
          <>
            {/* Net income hero + collection progress + quick stats */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginBottom: 28,
              }}
            >
              {/* Net income hero */}
              <div
                style={{
                  background: "#15151a",
                  border: "1px solid #1f1f26",
                  borderRadius: 16,
                  padding: "28px 28px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 24,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#7a7a82",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 12,
                    }}
                  >
                    Net income
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: "#f5f5f7",
                      marginBottom: 6,
                      lineHeight: 1.1,
                    }}
                  >
                    ₱
                    {netIncome.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div style={{ fontSize: 13, color: "#8b8b95" }}>
                    Income minus expenses
                  </div>
                </div>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  {[
                    { label: "Collected", value: collectedRevenue },
                    { label: "Expected", value: expectedRevenue },
                    { label: "Expenses", value: totalExpenses },
                  ].map((item) => (
                    <div key={item.label} style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#7a7a82",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 8,
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#f5f5f7",
                        }}
                      >
                        ₱{item.value.toLocaleString("en-PH")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collection progress */}
              <div
                style={{
                  background: "#15151a",
                  border: "1px solid #1f1f26",
                  borderRadius: 16,
                  padding: "22px 28px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{ fontSize: 14, fontWeight: 600, color: "#d4d4db" }}
                  >
                    Collection progress
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f7" }}
                  >
                    {collectionPct}% collected
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 8,
                    background: "#23232b",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${collectionPct}%`,
                      background: "#a3e635",
                      borderRadius: 8,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 10,
                    fontSize: 12,
                    color: "#8b8b95",
                  }}
                >
                  <span>
                    ₱
                    {pendingCollection.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    pending
                  </span>
                  <span>
                    ₱
                    {expectedRevenue.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    expected total
                  </span>
                </div>
              </div>

              {/* Quick stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 16,
                }}
              >
                {[
                  {
                    icon: "📋",
                    value: String(activeBookings),
                    label: "Active bookings",
                  },
                  {
                    icon: "👥",
                    value: String(
                      employees.filter((e) => e.status !== "revoked").length
                    ),
                    label: "Team size",
                  },
                  {
                    icon: "📅",
                    value: String(bookingsThisMonth),
                    label: "Bookings this month",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "#15151a",
                      border: "1px solid #1f1f26",
                      borderRadius: 16,
                      padding: "18px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                    }}
                  >
                    <div style={{ fontSize: 20 }}>{s.icon}</div>
                    <div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "#f5f5f7",
                          lineHeight: 1.1,
                        }}
                      >
                        {s.value}
                      </div>
                      <div style={{ fontSize: 12, color: "#8b8b95" }}>
                        {s.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 24,
                flexWrap: "wrap",
              }}
            >
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "6px 18px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 600,
                    border: activeTab === tab ? "none" : "1.5px solid #23232b",
                    background: activeTab === tab ? "#f5f5f7" : "#15151a",
                    color: activeTab === tab ? "#0a0a0c" : "#9a9aa5",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "Receivers" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Add receiver */}
                <div
                  style={{
                    background: "#15151a",
                    borderRadius: 16,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    border: "1px solid #1f1f26",
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#9a9aa5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 14,
                    }}
                  >
                    Add money receiver
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      type="text"
                      value={newReceiverName}
                      onChange={(e) => setNewReceiverName(e.target.value)}
                      placeholder="e.g. Sir James, Ate Rosa"
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddReceiver()
                      }
                      style={{
                        flex: 1,
                        padding: "11px 14px",
                        border: "1.5px solid #23232b",
                        borderRadius: 10,
                        fontSize: 14,
                        color: "#f5f5f7",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = "#2cb5b0")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "#23232b")
                      }
                    />
                    <button
                      onClick={handleAddReceiver}
                      disabled={addingReceiver || !newReceiverName.trim()}
                      style={{
                        background:
                          addingReceiver || !newReceiverName.trim()
                            ? "#23232b"
                            : "linear-gradient(135deg, #1a2744, #2cb5b0)",
                        color:
                          addingReceiver || !newReceiverName.trim()
                            ? "#8896a5"
                            : "white",
                        border: "none",
                        borderRadius: 10,
                        padding: "11px 24px",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor:
                          addingReceiver || !newReceiverName.trim()
                            ? "not-allowed"
                            : "pointer",
                        boxShadow:
                          addingReceiver || !newReceiverName.trim()
                            ? "none"
                            : "0 4px 16px rgba(44,181,176,0.3)",
                      }}
                    >
                      {addingReceiver ? "Adding..." : "+ Add"}
                    </button>
                  </div>
                </div>

                {/* Receivers list */}
                {receivers.length === 0 ? (
                  <div
                    style={{
                      background: "#15151a",
                      borderRadius: 16,
                      padding: 60,
                      textAlign: "center",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                      border: "1px solid #1f1f26",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
                    <h3 style={{ color: "#f5f5f7", marginBottom: 8 }}>
                      No receivers yet
                    </h3>
                    <p style={{ color: "#9a9aa5", fontSize: 14 }}>
                      Add the people who collect payments.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {receivers.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          background: "#15151a",
                          borderRadius: 14,
                          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                          border: "1px solid #1f1f26",
                          padding: "16px 24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background:
                                "linear-gradient(135deg, #1a2744, #2cb5b0)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontWeight: 700,
                              fontSize: 15,
                            }}
                          >
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 600,
                              color: "#f5f5f7",
                            }}
                          >
                            {r.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveReceiver(r.id)}
                          style={{
                            padding: "5px 14px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            border: "1.5px solid #fecaca",
                            background: "#fef2f2",
                            color: "#e74c3c",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Overview ── */}
            {activeTab === "Overview" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                {/* Recent bookings */}
                <div
                  style={{
                    background: "#15151a",
                    borderRadius: 16,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    border: "1px solid #1f1f26",
                    padding: "20px 24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#f5f5f7",
                      marginBottom: 16,
                    }}
                  >
                    Recent bookings
                  </div>
                  {bookings.slice(0, 6).map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: "1px solid #0a0a0c",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#f5f5f7",
                          }}
                        >
                          {b.guestName}
                        </div>
                        <div style={{ fontSize: 11, color: "#9a9aa5" }}>
                          {b.Property?.name} · {formatDate(b.checkIn)}
                        </div>
                      </div>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: STATUS_COLORS[b.status]?.bg,
                          color: STATUS_COLORS[b.status]?.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                  {bookings.length === 0 && (
                    <p style={{ fontSize: 13, color: "#9a9aa5" }}>
                      No bookings yet.
                    </p>
                  )}
                </div>

                {/* Recent expenses */}
                <div
                  style={{
                    background: "#15151a",
                    borderRadius: 16,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    border: "1px solid #1f1f26",
                    padding: "20px 24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#f5f5f7",
                      marginBottom: 16,
                    }}
                  >
                    Recent expenses
                  </div>
                  {expenseNotes.slice(0, 6).map((n) => (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: "1px solid #0a0a0c",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 20,
                            background: CATEGORY_COLORS[n.category]?.bg,
                            color: CATEGORY_COLORS[n.category]?.color,
                            marginRight: 8,
                          }}
                        >
                          {n.category}
                        </span>
                        <span style={{ fontSize: 13, color: "#f5f5f7" }}>
                          {n.content.slice(0, 35)}
                          {n.content.length > 35 ? "…" : ""}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#f5f5f7",
                          whiteSpace: "nowrap",
                          marginLeft: 12,
                        }}
                      >
                        ₱
                        {Number(n.amount).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                  {expenseNotes.length === 0 && (
                    <p style={{ fontSize: 13, color: "#9a9aa5" }}>
                      No expenses yet.
                    </p>
                  )}
                </div>

                {/* Recent payments */}
                <div
                  style={{
                    background: "#15151a",
                    borderRadius: 16,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    border: "1px solid #1f1f26",
                    padding: "20px 24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#f5f5f7",
                      marginBottom: 16,
                    }}
                  >
                    Recent payments
                  </div>
                  {payments.slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: "1px solid #0a0a0c",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#f5f5f7",
                          }}
                        >
                          {p.Booking?.guestName || "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "#9a9aa5" }}>
                          {p.type} ·{" "}
                          {p.paidAt ? formatDate(p.paidAt) : "Unpaid"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#f5f5f7",
                          }}
                        >
                          ₱
                          {Number(p.amount).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "1px 8px",
                            borderRadius: 20,
                            background: STATUS_COLORS[p.status]?.bg,
                            color: STATUS_COLORS[p.status]?.color,
                          }}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <p style={{ fontSize: 13, color: "#9a9aa5" }}>
                      No payments yet.
                    </p>
                  )}
                </div>

                {/* Team */}
                <div
                  style={{
                    background: "#15151a",
                    borderRadius: 16,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                    border: "1px solid #1f1f26",
                    padding: "20px 24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#f5f5f7",
                      marginBottom: 16,
                    }}
                  >
                    Team
                  </div>
                  {employees.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#9a9aa5" }}>
                      No employees yet. Go to the Employees tab to invite
                      someone.
                    </p>
                  ) : (
                    employees.slice(0, 6).map((e) => (
                      <div
                        key={e.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom: "1px solid #0a0a0c",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background:
                                "linear-gradient(135deg, #1a2744, #2cb5b0)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {e.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#f5f5f7",
                              }}
                            >
                              {e.name}
                            </div>
                            <div style={{ fontSize: 11, color: "#9a9aa5" }}>
                              {e.email}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 600,
                              background: ROLE_COLORS[e.role]?.bg,
                              color: ROLE_COLORS[e.role]?.color,
                            }}
                          >
                            {e.role}
                          </span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 600,
                              background: STATUS_COLORS[e.status]?.bg,
                              color: STATUS_COLORS[e.status]?.color,
                            }}
                          >
                            {e.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── Employees ── */}
            {activeTab === "Employees" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {employees.length === 0 ? (
                  <div
                    style={{
                      background: "#15151a",
                      borderRadius: 16,
                      padding: 60,
                      textAlign: "center",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                      border: "1px solid #1f1f26",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
                    <h3 style={{ color: "#f5f5f7", marginBottom: 8 }}>
                      No employees yet
                    </h3>
                    <p style={{ color: "#9a9aa5", fontSize: 14 }}>
                      Invite your first team member using the button above.
                    </p>
                  </div>
                ) : (
                  employees.map((emp) => (
                    <div
                      key={emp.id}
                      style={{
                        background: "#15151a",
                        borderRadius: 16,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                        border: "1px solid #1f1f26",
                        padding: "20px 24px",
                        borderLeft: `4px solid ${
                          STATUS_COLORS[emp.status]?.bg || "#23232b"
                        }`,
                        opacity: emp.status === "revoked" ? 0.6 : 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                          }}
                        >
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              background:
                                "linear-gradient(135deg, #1a2744, #2cb5b0)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontWeight: 700,
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: "#f5f5f7",
                                fontSize: 15,
                                marginBottom: 3,
                              }}
                            >
                              {emp.name}
                            </div>
                            <div style={{ fontSize: 13, color: "#9a9aa5" }}>
                              {emp.email}
                            </div>
                            {emp.invited_at && emp.status === "invited" && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#856404",
                                  marginTop: 2,
                                }}
                              >
                                Invited {formatDateTime(emp.invited_at)} ·
                                Awaiting first login
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              background: ROLE_COLORS[emp.role]?.bg,
                              color: ROLE_COLORS[emp.role]?.color,
                            }}
                          >
                            {emp.role}
                          </span>
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              background: STATUS_COLORS[emp.status]?.bg,
                              color: STATUS_COLORS[emp.status]?.color,
                            }}
                          >
                            {emp.status}
                          </span>
                          {emp.status === "revoked" ? (
                            <button
                              onClick={() => handleReactivate(emp)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                border: "1.5px solid #d4edda",
                                background: "#f0fff4",
                                color: "#155724",
                                cursor: "pointer",
                              }}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRevoke(emp)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 8,
                                fontSize: 12,
                                fontWeight: 600,
                                border: "1.5px solid #fff3cd",
                                background: "#fffdf0",
                                color: "#856404",
                                cursor: "pointer",
                              }}
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(emp)}
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
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Expenses ── */}
            {activeTab === "Expenses" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {expenseNotes.length === 0 ? (
                  <div
                    style={{
                      background: "#15151a",
                      borderRadius: 16,
                      padding: 60,
                      textAlign: "center",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                      border: "1px solid #1f1f26",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
                    <h3 style={{ color: "#f5f5f7", marginBottom: 8 }}>
                      No expenses recorded
                    </h3>
                    <p style={{ color: "#9a9aa5", fontSize: 14 }}>
                      Expenses added by housekeeping and auditors will appear
                      here.
                    </p>
                  </div>
                ) : (
                  expenseNotes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        background: "#15151a",
                        borderRadius: 16,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                        border: "1px solid #1f1f26",
                        padding: "18px 24px",
                        borderLeft: `4px solid ${
                          CATEGORY_COLORS[note.category]?.bg || "#23232b"
                        }`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: CATEGORY_COLORS[note.category]?.bg,
                            color: CATEGORY_COLORS[note.category]?.color,
                          }}
                        >
                          {note.category}
                        </span>
                        {note.amount > 0 && (
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: 16,
                              fontWeight: 700,
                              color: "#f5f5f7",
                            }}
                          >
                            ₱
                            {Number(note.amount).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: 14,
                          lineHeight: 1.65,
                          color: "#f5f5f7",
                          marginBottom: 10,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {note.content}
                      </p>
                      <div style={{ fontSize: 12, color: "#9a9aa5" }}>
                        {formatDateTime(note.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Payments ── */}
            {activeTab === "Payments" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {payments.length === 0 ? (
                  <div
                    style={{
                      background: "#15151a",
                      borderRadius: 16,
                      padding: 60,
                      textAlign: "center",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                      border: "1px solid #1f1f26",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
                    <h3 style={{ color: "#f5f5f7", marginBottom: 8 }}>
                      No payments yet
                    </h3>
                    <p style={{ color: "#9a9aa5", fontSize: 14 }}>
                      Payments will appear here once bookings are created.
                    </p>
                  </div>
                ) : (
                  payments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        background: "#15151a",
                        borderRadius: 16,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                        border: "1px solid #1f1f26",
                        padding: "20px 24px",
                        borderLeft: `4px solid ${
                          STATUS_COLORS[p.status]?.bg || "#23232b"
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
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#f5f5f7",
                              fontSize: 15,
                              marginBottom: 4,
                            }}
                          >
                            {p.Booking?.guestName || "—"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#9a9aa5",
                              marginBottom: 4,
                            }}
                          >
                            {p.Booking?.Property?.name || "—"} · {p.type}
                          </div>
                          {p.notes && (
                            <div
                              style={{
                                fontSize: 13,
                                color: "#9a9aa5",
                                fontStyle: "italic",
                              }}
                            >
                              {p.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: "#f5f5f7",
                              marginBottom: 6,
                            }}
                          >
                            ₱
                            {Number(p.amount).toLocaleString("en-PH", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              background: STATUS_COLORS[p.status]?.bg,
                              color: STATUS_COLORS[p.status]?.color,
                            }}
                          >
                            {p.status}
                          </span>
                          {p.paidAt && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#9a9aa5",
                                marginTop: 6,
                              }}
                            >
                              Paid {formatDate(p.paidAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Bookings ── */}
            {activeTab === "Bookings" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {/* Filter bar */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      flex: "1 1 220px",
                      minWidth: 180,
                    }}
                  >
                    <input
                      type="text"
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      placeholder="Search by name or contact..."
                      style={{
                        width: "100%",
                        padding: "9px 14px 9px 34px",
                        border: "1.5px solid #23232b",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "#f5f5f7",
                        outline: "none",
                        background: "#15151a",
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
                        color: "#9a9aa5",
                      }}
                    >
                      🔍
                    </span>
                  </div>

                  <select
                    value={filterProperty}
                    onChange={(e) => setFilterProperty(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      border: "1.5px solid #23232b",
                      borderRadius: 10,
                      fontSize: 13,
                      color: "#f5f5f7",
                      background: "#15151a",
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

                  <select
                    value={filterPlatform}
                    onChange={(e) => setFilterPlatform(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      border: "1.5px solid #23232b",
                      borderRadius: 10,
                      fontSize: 13,
                      color: "#f5f5f7",
                      background: "#15151a",
                      outline: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <option value="ALL">All Platforms</option>
                    <option value="Facebook">Facebook</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Airbnb">Airbnb</option>
                    <option value="Direct">Direct</option>
                    <option value="Walk-in">Walk-in</option>
                  </select>

                  <select
                    value={filterPaymentState}
                    onChange={(e) => setFilterPaymentState(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      border: "1.5px solid #23232b",
                      borderRadius: 10,
                      fontSize: 13,
                      color: "#f5f5f7",
                      background: "#15151a",
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

                  <select
                    value={filterBookingStatus}
                    onChange={(e) => setFilterBookingStatus(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      border: "1.5px solid #23232b",
                      borderRadius: 10,
                      fontSize: 13,
                      color: "#f5f5f7",
                      background: "#15151a",
                      outline: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <option value="ALL">All Status</option>
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

                {filteredBookings.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 24,
                      color: "#9a9aa5",
                    }}
                  >
                    No bookings found.
                  </div>
                ) : (
                  filteredBookings.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        background: "#15151a",
                        borderRadius: 16,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
                        border: "1px solid #1f1f26",
                        padding: "20px 24px",
                        borderLeft: `4px solid ${
                          STATUS_COLORS[b.status]?.bg || "#23232b"
                        }`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
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
                                color: "#f5f5f7",
                                fontSize: 15,
                              }}
                            >
                              {b.guestName}
                            </div>
                            <div style={{ fontSize: 12, color: "#9a9aa5" }}>
                              🏠 {b.Property?.name || "—"} · {b.source}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 20,
                            flexWrap: "wrap",
                          }}
                        >
                          {[
                            { label: "Check-in", val: formatDate(b.checkIn) },
                            { label: "Check-out", val: formatDate(b.checkOut) },
                            {
                              label: "Nights",
                              val: String(nights(b.checkIn, b.checkOut)),
                            },
                          ].map((item) => (
                            <div key={item.label}>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#9a9aa5",
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
                                  color: "#f5f5f7",
                                }}
                              >
                                {item.val}
                              </div>
                            </div>
                          ))}
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
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* ── Calendar ── */}
            {activeTab === "Calendar" && (
              <UnitCalendar properties={properties} bookings={bookings} />
            )}
          </>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteForm && (
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
          }}
        >
          <div
            style={{
              background: "#15151a",
              borderRadius: 20,
              padding: 36,
              width: "100%",
              maxWidth: 460,
              boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
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
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f5f5f7" }}>
                Invite Employee
              </h2>
              <button
                onClick={() => setShowInviteForm(false)}
                style={{
                  background: "#23232b",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 18,
                  color: "#9a9aa5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Full name *</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Maria Santos"
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#2cb5b0")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#23232b")
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>Email address *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="maria@example.com"
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#2cb5b0")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#23232b")
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>Role *</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={inputStyle}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {inviteError && (
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
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div
                  style={{
                    background: "#d4edda",
                    border: "1px solid #c3e6cb",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#155724",
                  }}
                >
                  ✓ {inviteSuccess}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => setShowInviteForm(false)}
                  style={{
                    flex: 1,
                    padding: 12,
                    border: "1.5px solid #23232b",
                    borderRadius: 10,
                    background: "#15151a",
                    color: "#9a9aa5",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={
                    inviting || !inviteName.trim() || !inviteEmail.trim()
                  }
                  style={{
                    flex: 2,
                    padding: 12,
                    background:
                      inviting || !inviteName.trim() || !inviteEmail.trim()
                        ? "#23232b"
                        : "linear-gradient(135deg, #1a2744, #2cb5b0)",
                    border: "none",
                    borderRadius: 10,
                    color:
                      inviting || !inviteName.trim() || !inviteEmail.trim()
                        ? "#8896a5"
                        : "white",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor:
                      inviting || !inviteName.trim() || !inviteEmail.trim()
                        ? "not-allowed"
                        : "pointer",
                    boxShadow:
                      inviting || !inviteName.trim() || !inviteEmail.trim()
                        ? "none"
                        : "0 4px 16px rgba(44,181,176,0.3)",
                  }}
                >
                  {inviting ? "Sending invite..." : "Send invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input::placeholder { color: #5c5c64; }
        select option { background: #15151a; color: #f5f5f7; }
      `}</style>
    </div>
  );
}
