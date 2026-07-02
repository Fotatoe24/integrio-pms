"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRole, IntegrioUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface ExpenseNote {
  id: string;
  content: string;
  category: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  created_by: string;
  owner_id: string;
}

interface Booking {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  propertyId?: string;
  Property?: { name: string };
}

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
    propertyId?: string;
    Property?: { name: string };
  };
}

interface PropertyOption {
  id: string;
  name: string;
}

const CATEGORIES = [
  "general",
  "cleaning",
  "supplies",
  "maintenance",
  "laundry",
  "other",
];

const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
];

const PAYMENT_STATUSES = ["PENDING", "PAID", "PARTIAL", "REFUNDED"];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
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

// Inline style objects used by the edit form and the Add Expense modal.
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #e8edf3",
  borderRadius: 10,
  fontSize: 14,
  color: "var(--brand-text, #1a2744)",
  outline: "none",
  fontFamily: "inherit",
  background: "var(--popover)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--brand-text-muted, #8896a5)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const filterInputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1.5px solid #e8edf3",
  borderRadius: 8,
  fontSize: 13,
  color: "#1a2744",
  background: "white",
  outline: "none",
};

const TABS = ["Overview", "Expenses", "Payments", "Bookings"] as const;
type Tab = (typeof TABS)[number];

export default function AuditorPage() {
  const router = useRouter();
  const [user, setUser] = useState<IntegrioUser | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);

  // Data
  const [expenseNotes, setExpenseNotes] = useState<ExpenseNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  // Filters (shared across tabs where applicable)
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");

  // Add expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expContent, setExpContent] = useState("");
  const [expCategory, setExpCategory] = useState("general");
  const [expAmount, setExpAmount] = useState("");
  const [expSaving, setExpSaving] = useState(false);
  const [expError, setExpError] = useState("");

  // Edit expense
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [editAmount, setEditAmount] = useState("");

  useEffect(() => {
    document.title = "Auditor — Integrio";
    const u = requireRole(["auditor"], router);
    if (u) {
      setUser(u);
      loadAll(u);
    }
  }, []);

  async function loadAll(u: IntegrioUser) {
    setLoading(true);
    const ownerId = u.owner_id ?? u.id;

    // Get owner's properties
    const { data: props } = await supabase
      .from("Property")
      .select("id, name")
      .eq("owner_id", ownerId)
      .order("name", { ascending: true });

    const propertyIds = (props ?? []).map((p) => p.id);
    if (props) setProperties(props);

    // No limit — full history, matching expense scope so stat cards
    // aren't comparing all-time expenses against a partial income slice.
    const { data: book } =
      propertyIds.length > 0
        ? await supabase
            .from("Booking")
            .select("*, Property(name)")
            .in("propertyId", propertyIds)
            .order("checkIn", { ascending: false })
        : { data: [] };

    const bookingIds = (book ?? []).map((b: { id: string }) => b.id);
    const { data: pay } =
      bookingIds.length > 0
        ? await supabase
            .from("Payment")
            .select("*, Booking(guestName, propertyId, Property(name))")
            .in("bookingId", bookingIds)
            .order("createdAt", { ascending: false })
        : { data: [] };

    const { data: exp } = await supabase
      .from("ExpenseNote")
      .select("*")
      .eq("owner_id", ownerId)
      .order("createdAt", { ascending: false });

    if (exp) setExpenseNotes(exp);
    if (pay) setPayments(pay);
    if (book) setBookings(book);
    setLoading(false);
  }

  async function handleAddExpense() {
    if (!expContent.trim() || !user) return;
    setExpSaving(true);
    setExpError("");
    const ownerId = user.owner_id ?? user.id;

    const { data, error } = await supabase
      .from("ExpenseNote")
      .insert({
        owner_id: ownerId,
        created_by: user.id,
        content: expContent.trim(),
        category: expCategory,
        amount: parseFloat(expAmount) || 0,
      })
      .select()
      .single();

    if (error) {
      setExpError(error.message);
    } else if (data) {
      setExpenseNotes((prev) => [data, ...prev]);
      setExpContent("");
      setExpCategory("general");
      setExpAmount("");
      setShowExpenseForm(false);
    }
    setExpSaving(false);
  }

  function startEdit(note: ExpenseNote) {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditCategory(note.category);
    setEditAmount(note.amount ? String(note.amount) : "");
  }

  async function handleSaveEdit(id: string) {
    const { data, error } = await supabase
      .from("ExpenseNote")
      .update({
        content: editContent.trim(),
        category: editCategory,
        amount: parseFloat(editAmount) || 0,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setExpenseNotes((prev) => prev.map((n) => (n.id === id ? data : n)));
      setEditingId(null);
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("Delete this expense?")) return;
    const { error } = await supabase.from("ExpenseNote").delete().eq("id", id);
    if (!error) setExpenseNotes((prev) => prev.filter((n) => n.id !== id));
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

  function nights(checkIn: string, checkOut: string) {
    return Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
    );
  }

  function inDateRange(iso: string | null) {
    if (!iso) return !dateFrom && !dateTo;
    const t = new Date(iso).getTime();
    if (dateFrom && t < new Date(dateFrom).getTime()) return false;
    if (dateTo && t > new Date(dateTo).getTime() + 86399999) return false;
    return true;
  }

  function resetFilters() {
    setSearch("");
    setPropertyFilter("all");
    setDateFrom("");
    setDateTo("");
    setCategoryFilter("all");
    setBookingStatusFilter("all");
    setPaymentStatusFilter("all");
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    propertyFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    categoryFilter !== "all" ||
    bookingStatusFilter !== "all" ||
    paymentStatusFilter !== "all";

  // Filtered datasets — these drive both the tab lists and the summary stats,
  // so the numbers on screen always match what's visible below them.
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (
        propertyFilter !== "all" &&
        b.propertyId !== propertyFilter &&
        b.Property?.name !== propertyFilter
      )
        return false;
      if (bookingStatusFilter !== "all" && b.status !== bookingStatusFilter)
        return false;
      if (!inDateRange(b.checkIn)) return false;
      if (
        search.trim() &&
        !b.guestName.toLowerCase().includes(search.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [bookings, propertyFilter, bookingStatusFilter, dateFrom, dateTo, search]);

  const filteredBookingIds = useMemo(
    () => new Set(filteredBookings.map((b) => b.id)),
    [filteredBookings]
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (!filteredBookingIds.has(p.bookingId)) return false;
      if (paymentStatusFilter !== "all" && p.status !== paymentStatusFilter)
        return false;
      if (
        search.trim() &&
        !(p.Booking?.guestName || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [payments, filteredBookingIds, paymentStatusFilter, search]);

  const filteredExpenses = useMemo(() => {
    return expenseNotes.filter((n) => {
      if (categoryFilter !== "all" && n.category !== categoryFilter)
        return false;
      if (!inDateRange(n.createdAt)) return false;
      if (
        search.trim() &&
        !n.content.toLowerCase().includes(search.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [expenseNotes, categoryFilter, dateFrom, dateTo, search]);

  // Summary stats — derived from the filtered sets
  const totalExpenses = filteredExpenses.reduce(
    (s, n) => s + Number(n.amount || 0),
    0
  );
  const totalPayments = filteredPayments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingPayments = filteredPayments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const netIncome = totalPayments - totalExpenses;

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--brand-bg, #f8f9fa)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--brand-surface, #f8f9fa)",
          borderBottom: "1px solid #e8edf3",
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
          <img
            src="/blacklogo.png"
            alt="Integrio"
            className="w-20 sm:w-20 h-auto block dark:hidden"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}
          />
          <img
            src="/darktrans.png"
            alt="Integrio"
            className="w-20 sm:w-20 h-auto hidden dark:block"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}
          />

          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              background: "#fff3cd",
              color: "#856404",
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            Auditor
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "#8896a5" }}>{user.name}</span>

          <a
            href="/settings"
            style={{
              fontSize: 13,
              color: "#8896a5",
              border: "1.5px solid #e8edf3",
              borderRadius: 8,
              padding: "6px 14px",
              textDecoration: "none",
            }}
          >
            Settings
          </a>

          <button
            onClick={logout}
            style={{
              fontSize: 13,
              color: "#8896a5",
              background: "none",
              border: "1.5px solid #e8edf3",
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
        style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--brand-text, #1a2744)",
                marginBottom: 4,
              }}
            >
              Audit Dashboard
            </h1>
            <p
              style={{
                color: "var(--brand-text-muted, #8896a5)",
                fontSize: 14,
              }}
            >
              Financial overview and expense management
            </p>
          </div>

          <button
            onClick={() => setShowExpenseForm(true)}
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
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 18 }}>+</span> Add Expense
          </button>
        </div>

        {/* Filter bar */}
        <div
          style={{
            background: "var(--brand-surface, white)",
            borderRadius: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            padding: 16,
            marginTop: 24,
            marginBottom: 28,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder={
                activeTab === "Expenses"
                  ? "Search expense description..."
                  : "Search guest name..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...filterInputStyle, flex: 1, minWidth: 200 }}
            />

            {activeTab !== "Expenses" && (
              <select
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                style={filterInputStyle}
              >
                <option value="all">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "Expenses" && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={filterInputStyle}
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "Bookings" && (
              <select
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                style={filterInputStyle}
              >
                <option value="all">All statuses</option>
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "Payments" && (
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                style={filterInputStyle}
              >
                <option value="all">All statuses</option>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                style={{
                  fontSize: 13,
                  color: "#2cb5b0",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "0 8px",
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
            }}
          >
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#8896a5",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Date range
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={filterInputStyle}
            />
            <span style={{ color: "#8896a5", fontSize: 13 }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={filterInputStyle}
            />
            <span style={{ fontSize: 12, color: "#8896a5" }}>
              Applies to check-in dates, expense entries, and date-filtered
              stats below.
            </span>
          </div>
        </div>

        {/* Summary stat cards */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
            Loading...
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 28,
              }}
            >
              {[
                {
                  label: "Total income",
                  value: `₱${totalPayments.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}`,
                  sub: "Paid payments (filtered)",
                  bg: "#d4edda",
                },
                {
                  label: "Total expenses",
                  value: `₱${totalExpenses.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}`,
                  sub: `${filteredExpenses.length} entries`,
                  bg: "#f8d7da",
                },
                {
                  label: "Pending collection",
                  value: `₱${pendingPayments.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}`,
                  sub: "Unpaid payments (filtered)",
                  bg: "#fff3cd",
                },
                {
                  label: "Net income",
                  value: `₱${netIncome.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}`,
                  sub: "Income minus expenses",
                  bg: netIncome >= 0 ? "#d1ecf1" : "#f8d7da",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "var(--brand-surface, white)",
                    borderRadius: 16,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    padding: "20px 24px",
                    borderTop: `3px solid ${stat.bg}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--brand-text-muted, #8896a5)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "var(--brand-text, #1a2744)",
                      marginBottom: 4,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--brand-text-muted, #8896a5)",
                    }}
                  >
                    {stat.sub}
                  </div>
                </div>
              ))}
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
                    border: activeTab === tab ? "none" : "1.5px solid #e8edf3",
                    background: activeTab === tab ? "#1a2744" : "white",
                    color: activeTab === tab ? "white" : "#8896a5",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === "Overview" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {/* Recent expenses */}
                  <div
                    style={{
                      background: "var(--brand-surface, white)",
                      borderRadius: 16,
                      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                      padding: "20px 24px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--brand-text, #1a2744)",
                        marginBottom: 16,
                      }}
                    >
                      Recent expenses
                    </div>
                    {expenseNotes.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom: "1px solid #f0f4f8",
                        }}
                      >
                        <div>
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
                          <span
                            style={{ fontSize: 13, color: "var(--brand-text)" }}
                          >
                            {n.content.slice(0, 40)}
                            {n.content.length > 40 ? "…" : ""}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--brand-text, #1a2744)",
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
                      <p style={{ fontSize: 13, color: "#8896a5" }}>
                        No expenses yet.
                      </p>
                    )}
                  </div>

                  {/* Recent payments */}
                  <div
                    style={{
                      background: "var(--brand-surface, white)",
                      borderRadius: 16,
                      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                      padding: "20px 24px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--brand-text, #1a2744)",
                        marginBottom: 16,
                      }}
                    >
                      Recent payments
                    </div>
                    {payments.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          borderBottom: "1px solid #f0f4f8",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--brand-text, #1a2744)",
                            }}
                          >
                            {p.Booking?.guestName || "—"}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--brand-text-muted, #8896a5)",
                            }}
                          >
                            {p.type} ·{" "}
                            {p.paidAt ? formatDate(p.paidAt) : "Unpaid"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--brand-text, #1a2744)",
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
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--brand-text-muted, #8896a5)",
                        }}
                      >
                        No payments yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Expenses */}
            {activeTab === "Expenses" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {filteredExpenses.length === 0 ? (
                  <div
                    style={{
                      background: "var(--brand-surface, white)",
                      borderRadius: 16,
                      padding: 60,
                      textAlign: "center",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
                    <h3
                      style={{
                        color: "var(--brand-text, #1a2744)",
                        marginBottom: 8,
                      }}
                    >
                      {expenseNotes.length === 0
                        ? "No expenses yet"
                        : "No expenses match your filters"}
                    </h3>
                    <p
                      style={{
                        color: "var(--brand-text-muted, #8896a5)",
                        fontSize: 14,
                      }}
                    >
                      {expenseNotes.length === 0
                        ? "Add the first expense using the button above."
                        : "Try adjusting or clearing the filters above."}
                    </p>
                  </div>
                ) : (
                  filteredExpenses.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        background: "var(--brand-surface, white)",
                        borderRadius: 16,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                        padding: "20px 24px",
                        borderLeft: `4px solid ${
                          CATEGORY_COLORS[note.category]?.bg || "#e8edf3"
                        }`,
                      }}
                    >
                      {editingId === note.id ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            style={{
                              ...inputStyle,
                              border: "1.5px solid #2cb5b0",
                              resize: "vertical",
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              style={{
                                padding: "8px 12px",
                                border: "1.5px solid #e8edf3",
                                borderRadius: 8,
                                fontSize: 13,
                                color: "var(--brand-text, #1a2744)",
                                background: "var(--brand-surface, white)",
                                outline: "none",
                              }}
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c.charAt(0).toUpperCase() + c.slice(1)}
                                </option>
                              ))}
                            </select>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                border: "1.5px solid #e8edf3",
                                borderRadius: 8,
                                padding: "0 12px",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  color: "var(--brand-text, #1a2744)",
                                }}
                              >
                                ₱
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                style={{
                                  border: "none",
                                  outline: "none",
                                  fontSize: 14,
                                  color: "var(--brand-text, #1a2744)",
                                  width: 90,
                                  padding: "8px 0",
                                  fontFamily: "inherit",
                                }}
                              />
                            </div>
                            <div
                              style={{
                                marginLeft: "auto",
                                display: "flex",
                                gap: 8,
                              }}
                            >
                              <button
                                onClick={() => setEditingId(null)}
                                style={{
                                  padding: "7px 16px",
                                  border:
                                    "1.5px solid var(--brand-border, #e8edf3)",
                                  borderRadius: 8,
                                  background: "var(--brand-surface, white)",
                                  color: "var(--brand-text-muted, #8896a5)",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(note.id)}
                                style={{
                                  padding: "7px 16px",
                                  background:
                                    "linear-gradient(135deg, #1a2744, #2cb5b0)",
                                  border: "none",
                                  borderRadius: 8,
                                  color: "white",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  boxShadow: "0 4px 16px rgba(44,181,176,0.3)",
                                }}
                              >
                                Save changes
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 10,
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
                                  color: "var(--brand-text, #1a2744)",
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
                              color: "var(--brand-text, #1a2744)",
                              marginBottom: 14,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {note.content}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#8896a5" }}>
                              {formatDateTime(note.createdAt)}
                            </span>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => startEdit(note)}
                                style={{
                                  padding: "5px 14px",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  border: "1.5px solid #e8edf3",
                                  background: "var(--brand-surface, white)",
                                  color: "var(--brand-text, #1a2744)",
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(note.id)}
                                style={{
                                  padding: "5px 14px",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  border: "1.5px solid #fecaca",
                                  background: "var(--brand-surface, white)",
                                  color: "var(--brand-danger, #e74c3c)",
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Payments */}
            {activeTab === "Payments" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {filteredPayments.length === 0 ? (
                  <div
                    style={{
                      background: "var(--brand-surface, white)",
                      borderRadius: 16,
                      padding: 60,
                      textAlign: "center",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
                    <h3 style={{ color: "#1a2744", marginBottom: 8 }}>
                      {payments.length === 0
                        ? "No payments recorded"
                        : "No payments match your filters"}
                    </h3>
                    <p
                      style={{
                        color: "var(--brand-text-muted, #8896a5)",
                        fontSize: 14,
                      }}
                    >
                      {payments.length === 0
                        ? "Payments will appear here once bookings are created."
                        : "Try adjusting or clearing the filters above."}
                    </p>
                  </div>
                ) : (
                  filteredPayments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        background: "var(--brand-surface, white)",
                        borderRadius: 16,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                        padding: "20px 24px",
                        borderLeft: `4px solid ${
                          STATUS_COLORS[p.status]?.bg ||
                          "var(--brand-surface, white)"
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
                              color: "var(--brand-text, #1a2744)",
                              fontSize: 16,
                              marginBottom: 4,
                            }}
                          >
                            {p.Booking?.guestName || "—"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--brand-text-muted, #8896a5)",
                              marginBottom: 8,
                            }}
                          >
                            {p.Booking?.Property?.name || "—"} · {p.type}
                          </div>
                          {p.notes && (
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--brand-text-muted, #8896a5)",
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
                              color: "var(--brand-text, #1a2744)",
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
                                color: "var(--brand-text-muted, #8896a5)",
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

            {/* Tab: Bookings */}
            {activeTab === "Bookings" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {filteredBookings.length === 0 ? (
                  <div
                    style={{
                      background: "var(--brand-surface, white)",
                      borderRadius: 16,
                      padding: 60,
                      textAlign: "center",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                    <h3
                      style={{
                        color: "var(--brand-text, #1a2744)",
                        marginBottom: 8,
                      }}
                    >
                      {bookings.length === 0
                        ? "No bookings found"
                        : "No bookings match your filters"}
                    </h3>
                    <p
                      style={{
                        color: "var(--brand-text-muted, #8896a5)",
                        fontSize: 14,
                      }}
                    >
                      {bookings.length === 0
                        ? "Bookings will appear here once created by the booker."
                        : "Try adjusting or clearing the filters above."}
                    </p>
                  </div>
                ) : (
                  filteredBookings.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        background: "var(--brand-surface, white)",
                        borderRadius: 16,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                        padding: "20px 24px",
                        borderLeft: `4px solid ${
                          STATUS_COLORS[b.status]?.bg ||
                          "var(--brand-surface, white)"
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
                                color: "var(--brand-text, #1a2744)",
                                fontSize: 15,
                              }}
                            >
                              {b.guestName}
                            </div>
                            <div style={{ fontSize: 12, color: "#8896a5" }}>
                              🏠 {b.Property?.name || "—"}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
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
                                  color: "var(--brand-text-muted, #8896a5)",
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
                                  color: "var(--brand-text, #1a2744)",
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
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      {showExpenseForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 24,
          }}
        >
          <div
            style={{
              background: "var(--brand-surface, white)",
              borderRadius: 20,
              padding: 36,
              width: "100%",
              maxWidth: 480,
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
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--brand-text, #1a2744)",
                }}
              >
                Add Expense
              </h2>
              <button
                onClick={() => setShowExpenseForm(false)}
                style={{
                  background: "var(--brand-surface, white)",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 18,
                  color: "var(--brand-text, #1a2744)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                X
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Description *</label>
                <textarea
                  value={expContent}
                  onChange={(e) => setExpContent(e.target.value)}
                  placeholder="Describe the expense..."
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    color: "var(--brand-text, #1a2744)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "var(--brand-primary, #2cb5b0)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      "var(--brand-border, #e8edf3)")
                  }
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
                  <label style={labelStyle}>Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    style={inputStyle}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Amount (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#2cb5b0")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#e8edf3")
                    }
                  />
                </div>
              </div>

              {expError && (
                <div
                  style={{
                    background: "var(--brand-error, #fef2f2)",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "var(--brand-error-text, #e74c3c)",
                  }}
                >
                  {expError}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => setShowExpenseForm(false)}
                  style={{
                    flex: 1,
                    padding: 12,
                    border: "1.5px solid #e8edf3",
                    borderRadius: 10,
                    background: "var(--brand-surface, white)",
                    color: "var(--brand-text-muted, #8896a5)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddExpense}
                  disabled={expSaving || !expContent.trim()}
                  style={{
                    flex: 2,
                    padding: 12,
                    background:
                      expSaving || !expContent.trim()
                        ? "#e8edf3"
                        : "linear-gradient(135deg, #1a2744, #2cb5b0)",
                    border: "none",
                    borderRadius: 10,
                    color:
                      expSaving || !expContent.trim() ? "#8896a5" : "white",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor:
                      expSaving || !expContent.trim()
                        ? "not-allowed"
                        : "pointer",
                    boxShadow:
                      expSaving || !expContent.trim()
                        ? "none"
                        : "0 4px 16px rgba(44,181,176,0.3)",
                  }}
                >
                  {expSaving ? "Saving..." : "Save Expense"}
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
      `}</style>
    </div>
  );
}
