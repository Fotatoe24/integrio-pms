"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  | "Calendar"
  | "Redflags"
  | "Checklist";

type OverviewMode = "week" | "month" | "year";

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
  bookedBy?: string | null;
  Property?: { name: string };
  Payment?: Payment[];
}

interface Property {
  id: string;
  name: string;
}

interface RedFlag {
  type: "PUNCTUALITY" | "DIRTY_UNIT" | "UNPAID_BALANCE";
  severity: "warn" | "danger";
  message: string;
}

interface ChecklistItemRow {
  id: string;
  label: string;
  sort_order: number;
}

interface ChecklistRow {
  id: string;
  title: string;
  is_active: boolean;
  createdAt: string;
  ChecklistItem: ChecklistItemRow[];
}

const ROLES = ["booker", "auditor", "housekeeping"];

const COMMISSION_PER_BOOKING = 100;
const BOOKINGS_PER_PAGE = 8;
const PAYMENTS_PER_PAGE = 8;

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  booker: { bg: "rgba(24,119,242,.14)", color: "#1877F2" },
  auditor: { bg: "rgba(200,125,0,.15)", color: "var(--amber)" },
  housekeeping: { bg: "rgba(0,138,5,.13)", color: "var(--green)" },
  owner: { bg: "rgba(108,92,231,.16)", color: "var(--violet)" },
  ADMIN: { bg: "rgba(108,92,231,.16)", color: "var(--violet)" },
  STAFF: { bg: "rgba(24,119,242,.14)", color: "#1877F2" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: "rgba(0,138,5,.13)", color: "var(--green)" },
  invited: { bg: "rgba(200,125,0,.15)", color: "var(--amber)" },
  revoked: { bg: "rgba(255,56,92,.14)", color: "var(--rausch)" },
  PENDING: { bg: "rgba(200,125,0,.15)", color: "var(--amber)" },
  CONFIRMED: { bg: "rgba(108,92,231,.16)", color: "var(--violet)" },
  CHECKED_IN: { bg: "rgba(0,138,5,.13)", color: "var(--green)" },
  CHECKED_OUT: { bg: "var(--bg-2)", color: "var(--gray)" },
  CANCELLED: { bg: "rgba(255,56,92,.14)", color: "var(--rausch)" },
  PAID: { bg: "rgba(0,138,5,.13)", color: "var(--green)" },
  PARTIAL: { bg: "rgba(200,125,0,.15)", color: "var(--amber)" },
  REFUNDED: { bg: "rgba(255,56,92,.14)", color: "var(--rausch)" },
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  general: { bg: "var(--bg-2)", color: "var(--gray)" },
  cleaning: { bg: "rgba(24,119,242,.14)", color: "#1877F2" },
  supplies: { bg: "rgba(200,125,0,.15)", color: "var(--amber)" },
  maintenance: { bg: "rgba(255,56,92,.14)", color: "var(--rausch)" },
  laundry: { bg: "rgba(0,138,5,.13)", color: "var(--green)" },
  other: { bg: "rgba(108,92,231,.16)", color: "var(--violet)" },
};

const FLAG_META: Record<RedFlag["type"], { icon: string; label: string }> = {
  PUNCTUALITY: { icon: "⏰", label: "Punctuality" },
  DIRTY_UNIT: { icon: "🧹", label: "Unit not ready" },
  UNPAID_BALANCE: { icon: "💸", label: "Unpaid balance" },
};

// ── Date range helpers ──────────────────────────────────────────────────

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function getWeekRange(base: Date, offset: number = 0): [Date, Date] {
  const d = new Date(base);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [startOfDay(monday), endOfDay(sunday)];
}

function getMonthRange(base: Date, offset: number): [Date, Date] {
  const start = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const end = new Date(
    base.getFullYear(),
    base.getMonth() + offset + 1,
    0,
    23,
    59,
    59,
    999
  );
  return [startOfDay(start), end];
}

function getYearRange(base: Date, offset: number): [Date, Date] {
  const year = base.getFullYear() + offset;
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return [startOfDay(start), end];
}

function inRange(iso: string | null | undefined, range: [Date, Date]) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range[0].getTime() && t <= range[1].getTime();
}

function getDaysInRange(range: [Date, Date]) {
  const ms = range[1].getTime() - range[0].getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

function computeOccupancy(
  bookingsSubset: Booking[],
  unitCount: number,
  range: [Date, Date]
): number {
  const days = getDaysInRange(range);
  const totalSlots = unitCount * days * 2;
  if (totalSlots === 0) return 0;

  const occupiedSlots = bookingsSubset
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => {
      const slots = b.stayType === "Day (Long) 2PM-11AM" ? 2 : 1;
      return sum + slots;
    }, 0);

  return Math.min(100, Math.round((occupiedSlots / totalSlots) * 100));
}

function formatRangeLabel(range: [Date, Date], mode: OverviewMode) {
  if (mode === "year") {
    return range[0].toLocaleDateString("en-PH", { year: "numeric" });
  }
  if (mode === "month") {
    return range[0].toLocaleDateString("en-PH", {
      month: "long",
      year: "numeric",
    });
  }
  const startLabel = range[0].toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  const endLabel = range[1].toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

// ── Shared stat computation ─────────────────────────────────────────────

interface StatBundle {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  collectedRevenue: number;
  expectedRevenue: number;
  pendingCollection: number;
  collectionPct: number;
  bookingsCount: number;
}

function computeStats(
  bookingsSubset: Booking[],
  paymentsSubset: Payment[],
  expensesSubset: ExpenseNote[]
): StatBundle {
  const totalIncome = paymentsSubset
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = expensesSubset.reduce(
    (s, n) => s + Number(n.amount),
    0
  );
  const pendingCollection = paymentsSubset
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + Number(p.amount), 0);
  const netIncome = totalIncome - totalExpenses;

  const collectedRevenue = bookingsSubset.reduce((sum, b) => {
    const paid = (b.Payment || [])
      .filter(
        (p) =>
          p.status === "PAID" && (p.type === "DOWNPAYMENT" || p.type === "FULL")
      )
      .reduce((s, p) => s + Number(p.amount), 0);
    return sum + paid;
  }, 0);

  const expectedRevenue = bookingsSubset
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => sum + Number(b.totalFee || 0), 0);

  const collectionPct =
    expectedRevenue > 0
      ? Math.min(100, Math.round((collectedRevenue / expectedRevenue) * 100))
      : 0;

  return {
    totalIncome,
    totalExpenses,
    netIncome,
    collectedRevenue,
    expectedRevenue,
    pendingCollection,
    collectionPct,
    bookingsCount: bookingsSubset.length,
  };
}

function getBookingPaymentBreakdown(b: Booking) {
  const paidPayments = (b.Payment || []).filter((p) => p.status === "PAID");
  const downPayment = paidPayments
    .filter((p) => p.type === "DOWNPAYMENT")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalCost = Number(b.totalFee || 0);
  const balance = Math.max(0, totalCost - totalPaid);
  return { downPayment, totalPaid, totalCost, balance };
}

function getBookingPaymentState(b: Booking) {
  const { totalPaid, totalCost } = getBookingPaymentBreakdown(b);
  if (totalPaid <= 0) return "UNPAID";
  if (totalPaid >= totalCost && totalCost > 0) return "FULLY_PAID";
  return "PARTIAL";
}

export default function OwnerPage() {
  const router = useRouter();
  const [user, setUser] = useState<IntegrioUser | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

  // Pagination
  const [bookingsPage, setBookingsPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);

  // Overview period filter
  const [overviewMode, setOverviewMode] = useState<OverviewMode>("week");
  const [periodOffset, setPeriodOffset] = useState(0);

  // Redflags
  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);

  // Checklist manager
  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistItems, setNewChecklistItems] = useState("");
  const [creatingChecklist, setCreatingChecklist] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(
    null
  );
  const [editTitle, setEditTitle] = useState("");
  const [editItemsText, setEditItemsText] = useState("");
  const [savingChecklist, setSavingChecklist] = useState(false);

  useEffect(() => {
    document.title = "Owner — Integrio";
    const stored = (typeof window !== "undefined" &&
      localStorage.getItem("integrio_theme")) as "light" | "dark" | null;
    const initialTheme = stored || "light";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
    const u = requireRole(["owner", "ADMIN"], router);
    if (u) {
      setUser(u);
      loadAll(u);
      loadFlags(u);
      loadChecklists(u);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("integrio_theme", next);
  }

  async function loadAll(u: IntegrioUser) {
    setLoading(true);
    const ownerId = u.id;

    const { data: props } = await supabase
      .from("Property")
      .select("id, name")
      .eq("owner_id", ownerId);

    const propertyIds = (props ?? []).map((p) => p.id);
    setProperties(props ?? []);

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

    const bookingIds = (book ?? []).map((b) => b.id);
    const { data: pay } =
      bookingIds.length > 0
        ? await supabase
            .from("Payment")
            .select("*, Booking(guestName, Property(name))")
            .in("bookingId", bookingIds)
            .order("createdAt", { ascending: false })
        : { data: [] };

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

  async function loadFlags(u: IntegrioUser) {
    setFlagsLoading(true);
    try {
      const res = await fetch(`/api/owner/redflags?owner_id=${u.id}`);
      const json = await res.json();
      setFlags(json.flags || []);
    } catch {
      setFlags([]);
    }
    setFlagsLoading(false);
  }

  async function loadChecklists(u: IntegrioUser) {
    setChecklistLoading(true);
    try {
      const res = await fetch(`/api/owner/checklist?owner_id=${u.id}`);
      const json = await res.json();
      setChecklists(json.checklists || []);
    } catch {
      setChecklists([]);
    }
    setChecklistLoading(false);
  }

  async function handleCreateChecklist() {
    if (!newChecklistTitle.trim() || !user) return;
    const items = newChecklistItems
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;

    setCreatingChecklist(true);
    try {
      const res = await fetch("/api/owner/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: user.id,
          title: newChecklistTitle.trim(),
          items,
        }),
      });
      if (res.ok) {
        setNewChecklistTitle("");
        setNewChecklistItems("");
        loadChecklists(user);
      }
    } finally {
      setCreatingChecklist(false);
    }
  }

  function startEditChecklist(c: ChecklistRow) {
    setEditingChecklistId(c.id);
    setEditTitle(c.title);
    setEditItemsText(
      [...c.ChecklistItem]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => i.label)
        .join("\n")
    );
  }

  async function handleSaveChecklist(id: string) {
    const items = editItemsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setSavingChecklist(true);
    try {
      const res = await fetch("/api/owner/checklist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: editTitle.trim(), items }),
      });
      if (res.ok) {
        setEditingChecklistId(null);
        if (user) loadChecklists(user);
      }
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleDeleteChecklist(id: string) {
    if (!confirm("Remove this checklist? Housekeeping will no longer see it."))
      return;
    const res = await fetch(`/api/owner/checklist?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok && user) loadChecklists(user);
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

  function formatCurrency(n: number) {
    return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
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

  // ── Period range for Overview ─────────────────────────────────────────
  const periodRange = useMemo<[Date, Date]>(() => {
    const now = new Date();
    if (overviewMode === "week") return getWeekRange(now, periodOffset);
    if (overviewMode === "year") return getYearRange(now, periodOffset);
    return getMonthRange(now, periodOffset);
  }, [overviewMode, periodOffset]);

  const periodLabel = useMemo(
    () => formatRangeLabel(periodRange, overviewMode),
    [periodRange, overviewMode]
  );

  const periodBookings = useMemo(
    () => bookings.filter((b) => inRange(b.checkIn, periodRange)),
    [bookings, periodRange]
  );
  const periodPayments = useMemo(
    () => payments.filter((p) => inRange(p.paidAt, periodRange)),
    [payments, periodRange]
  );
  const periodExpenses = useMemo(
    () => expenseNotes.filter((n) => inRange(n.createdAt, periodRange)),
    [expenseNotes, periodRange]
  );

  const periodStats = useMemo(
    () => computeStats(periodBookings, periodPayments, periodExpenses),
    [periodBookings, periodPayments, periodExpenses]
  );

  const periodOccupancy = useMemo(
    () => computeOccupancy(periodBookings, properties.length, periodRange),
    [periodBookings, properties, periodRange]
  );

  const activeTeamSize = employees.filter((e) => e.status !== "revoked").length;

  function shiftPeriod(delta: number) {
    setPeriodOffset((o) => o + delta);
  }

  // ── Commission leaderboard ──────────────────────────────────────────
  const leaderboard = useMemo(() => {
    const people: { id: string; name: string; role: string }[] = [
      ...(user ? [{ id: user.id, name: user.name, role: "owner" }] : []),
      ...employees
        .filter((e) => e.status !== "revoked")
        .map((e) => ({ id: e.id, name: e.name, role: e.role })),
    ];

    return people
      .map((person) => {
        const personBookings = bookings.filter(
          (b) => b.bookedBy === person.id && b.status !== "CANCELLED"
        );
        const revenueGenerated = personBookings.reduce((sum, b) => {
          const paid = (b.Payment || [])
            .filter((p) => p.status === "PAID")
            .reduce((s, p) => s + Number(p.amount), 0);
          return sum + paid;
        }, 0);
        return {
          person,
          bookingsCount: personBookings.length,
          revenueGenerated,
          commission: personBookings.length * COMMISSION_PER_BOOKING,
        };
      })
      .sort((a, b) => b.commission - a.commission);
  }, [employees, bookings, user]);

  const hasAttributedBookings = bookings.some((b) => !!b.bookedBy);

  // ── Filtered + paginated bookings ───────────────────────────────────
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

  useEffect(() => {
    setBookingsPage(1);
  }, [
    filterProperty,
    filterPlatform,
    filterBookingStatus,
    filterPaymentState,
    bookingSearch,
  ]);

  const totalBookingsPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / BOOKINGS_PER_PAGE)
  );
  const paginatedBookings = filteredBookings.slice(
    (bookingsPage - 1) * BOOKINGS_PER_PAGE,
    bookingsPage * BOOKINGS_PER_PAGE
  );

  const totalPaymentsPages = Math.max(
    1,
    Math.ceil(payments.length / PAYMENTS_PER_PAGE)
  );
  const paginatedPayments = payments.slice(
    (paymentsPage - 1) * PAYMENTS_PER_PAGE,
    paymentsPage * PAYMENTS_PER_PAGE
  );

  const TABS: Tab[] = [
    "Overview",
    "Redflags",
    "Checklist",
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
    border: "1px solid var(--brand-border)",
    borderRadius: 12,
    fontSize: 14,
    color: "var(--brand-text)",
    outline: "none",
    fontFamily: "inherit",
    background: "var(--brand-surface)",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: "vertical",
    lineHeight: 1.6,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--brand-text)",
    marginBottom: 7,
  };

  const paginationBtnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    border: "1px solid var(--brand-border)",
    background: "var(--brand-surface)",
    color: disabled ? "var(--brand-text-muted)" : "var(--brand-text)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: ".15s",
  });

  const dangerFlags = flags.filter((f) => f.severity === "danger").length;
  const warnFlags = flags.filter((f) => f.severity === "warn").length;

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--brand-bg)",
        fontFamily:
          '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "var(--brand-text)",
        transition: "background-color .2s, color .2s",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--nav-bg)",
          backdropFilter: "saturate(180%) blur(10px)",
          borderBottom: "1px solid var(--brand-border)",
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
              fontWeight: 700,
              background: "var(--brand-surface)",
              color: "var(--brand-text-muted)",
              border: "1px solid var(--brand-border)",
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            Owner
          </span>

          {!flagsLoading && flags.length > 0 && (
            <button
              onClick={() => setActiveTab("Redflags")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                background:
                  dangerFlags > 0
                    ? "rgba(255,56,92,.14)"
                    : "rgba(200,125,0,.15)",
                color: dangerFlags > 0 ? "var(--rausch)" : "var(--amber)",
                border: "none",
                borderRadius: 999,
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              🚩 {flags.length} flag{flags.length === 1 ? "" : "s"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 13,
              color: "var(--brand-text)",
              marginRight: 4,
            }}
          >
            {user.name}
          </span>

          <button
            onClick={toggleTheme}
            aria-label="Toggle day or dark view"
            title="Toggle day / dark view"
            style={{
              width: 38,
              height: 38,
              border: "1px solid var(--brand-border)",
              borderRadius: "50%",
              background: "var(--brand-surface)",
              color: "var(--brand-text)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            {theme === "dark" ? (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>

          <a
            href="/settings"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--brand-text)",
              border: "1px solid var(--brand-border)",
              borderRadius: 12,
              padding: "8px 16px",
              textDecoration: "none",
            }}
          >
            Settings
          </a>
          <button
            onClick={logout}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--brand-text-muted)",
              background: "none",
              border: "1px solid var(--brand-border)",
              borderRadius: 12,
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div
        style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 24px 80px" }}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-.02em",
                color: "var(--brand-text)",
                marginBottom: 4,
              }}
            >
              Owner Dashboard
            </h1>
            <p style={{ color: "var(--brand-text-muted)", fontSize: 15 }}>
              Full visibility across all operations
            </p>
          </div>

          {activeTab === "Overview" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => shiftPeriod(-1)}
                  aria-label="Previous period"
                  style={paginationBtnStyle(false)}
                >
                  ‹
                </button>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--brand-text)",
                    minWidth: 130,
                    textAlign: "center",
                  }}
                >
                  {periodLabel}
                </span>
                <button
                  onClick={() => shiftPeriod(1)}
                  aria-label="Next period"
                  style={paginationBtnStyle(false)}
                >
                  ›
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  border: "1px solid var(--brand-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {(["week", "month", "year"] as OverviewMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setOverviewMode(m);
                      setPeriodOffset(0);
                    }}
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      background:
                        overviewMode === m
                          ? "var(--brand-text)"
                          : "var(--brand-surface)",
                      color:
                        overviewMode === m
                          ? "var(--background)"
                          : "var(--brand-text-muted)",
                    }}
                  >
                    {m === "week"
                      ? "Weekly"
                      : m === "month"
                      ? "Monthly"
                      : "Yearly"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "Employees" && (
            <button
              onClick={() => {
                setShowInviteForm(true);
                setInviteError("");
                setInviteSuccess("");
              }}
              style={{
                background: "var(--rausch)",
                border: "1px solid var(--rausch)",
                color: "white",
                borderRadius: 12,
                padding: "11px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>+</span> Invite Employee
            </button>
          )}
        </div>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              color: "var(--brand-text-muted)",
            }}
          >
            Loading...
          </div>
        ) : (
          <>
            {/* ── Overview ── */}
            {activeTab === "Overview" && (
              <>
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
                      background: "var(--brand-surface)",
                      border: "1px solid var(--brand-border)",
                      borderRadius: 20,
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
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: "var(--brand-text-muted)",
                          marginBottom: 12,
                        }}
                      >
                        Net income · {periodLabel}
                      </div>
                      <div
                        style={{
                          fontSize: 36,
                          fontWeight: 800,
                          letterSpacing: "-.02em",
                          color: "var(--brand-text)",
                          marginBottom: 6,
                          lineHeight: 1.1,
                        }}
                      >
                        {formatCurrency(periodStats.netIncome)}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--brand-text-muted)",
                        }}
                      >
                        Income minus expenses for this{" "}
                        {overviewMode === "week"
                          ? "week"
                          : overviewMode === "month"
                          ? "month"
                          : "year"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                      {[
                        {
                          label: "Collected",
                          value: periodStats.collectedRevenue,
                        },
                        {
                          label: "Expected",
                          value: periodStats.expectedRevenue,
                        },
                        { label: "Expenses", value: periodStats.totalExpenses },
                      ].map((item) => (
                        <div key={item.label} style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 700,
                              color: "var(--brand-text-muted)",
                              marginBottom: 8,
                            }}
                          >
                            {item.label}
                          </div>
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 800,
                              color: "var(--brand-text)",
                            }}
                          >
                            ₱{item.value.toLocaleString("en-PH")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {[
                      {
                        icon: "👥",
                        value: String(activeTeamSize),
                        label: "Team size",
                      },
                      {
                        icon: "📅",
                        value: String(periodStats.bookingsCount),
                        label: `Bookings this ${
                          overviewMode === "week"
                            ? "week"
                            : overviewMode === "month"
                            ? "month"
                            : "year"
                        }`,
                      },

                      {
                        icon: "🛏️",
                        value: `${periodOccupancy}%`,
                        label: "Occupancy rate",
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{
                          background: "var(--brand-surface)",
                          border: "1px solid var(--brand-border)",
                          borderRadius: 18,
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
                              fontWeight: 800,
                              color: "var(--brand-text)",
                              lineHeight: 1.1,
                            }}
                          >
                            {s.value}
                          </div>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: "var(--brand-text-muted)",
                              fontWeight: 600,
                            }}
                          >
                            {s.label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commission leaderboard */}
                <div
                  style={{
                    background: "var(--brand-surface)",
                    borderRadius: 20,
                    boxShadow: "var(--shadow-s)",
                    border: "1px solid var(--brand-border)",
                    padding: "22px 24px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: "var(--brand-text)",
                      }}
                    >
                      🏆 Commission leaderboard
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--brand-text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      ₱{COMMISSION_PER_BOOKING} per booking handled
                    </span>
                  </div>

                  {!hasAttributedBookings && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--brand-text-muted)",
                        marginBottom: 12,
                      }}
                    >
                      No bookings are attributed to an employee yet, so
                      commissions can&apos;t be calculated. Make sure bookings
                      store which employee handled them.
                    </p>
                  )}

                  {leaderboard.length === 0 ? (
                    <p
                      style={{ fontSize: 13, color: "var(--brand-text-muted)" }}
                    >
                      No active employees yet.
                    </p>
                  ) : (
                    leaderboard.map((entry, i) => (
                      <div
                        key={entry.person.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 0",
                          borderTop:
                            i === 0 ? "none" : "1px solid var(--brand-border)",
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
                              width: 28,
                              textAlign: "center",
                              fontSize: 15,
                              fontWeight: 800,
                              color: "var(--brand-text-muted)",
                            }}
                          >
                            {i === 0
                              ? "🥇"
                              : i === 1
                              ? "🥈"
                              : i === 2
                              ? "🥉"
                              : `#${i + 1}`}
                          </div>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, var(--rausch), #C13584)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontWeight: 700,
                              fontSize: 14,
                              flexShrink: 0,
                            }}
                          >
                            {entry.person.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: "var(--brand-text)",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              {entry.person.name}
                              <span
                                style={{
                                  padding: "1px 8px",
                                  borderRadius: 999,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background:
                                    ROLE_COLORS[entry.person.role]?.bg,
                                  color: ROLE_COLORS[entry.person.role]?.color,
                                }}
                              >
                                {entry.person.role}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--brand-text-muted)",
                                fontWeight: 600,
                              }}
                            >
                              {entry.bookingsCount} booking
                              {entry.bookingsCount === 1 ? "" : "s"} ·{" "}
                              {formatCurrency(entry.revenueGenerated)} collected
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: "var(--brand-text)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatCurrency(entry.commission)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 24,
                marginTop: activeTab === "Overview" ? 24 : 0,
                flexWrap: "wrap",
              }}
            >
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
                      activeTab === tab
                        ? "var(--rausch)"
                        : "var(--brand-text-muted)",
                    cursor: "pointer",
                    transition: "background .15s, color .15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {tab}
                  {tab === "Redflags" && flags.length > 0 && (
                    <span
                      style={{
                        background:
                          activeTab === tab ? "var(--rausch)" : "var(--rausch)",
                        color: "white",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "1px 6px",
                        minWidth: 16,
                        textAlign: "center",
                      }}
                    >
                      {flags.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Redflags ── */}
            {activeTab === "Redflags" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {flagsLoading ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: "var(--brand-text-muted)",
                    }}
                  >
                    Checking for issues...
                  </div>
                ) : flags.length === 0 ? (
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
                    <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                    <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
                      No issues right now
                    </h3>
                    <p
                      style={{ color: "var(--brand-text-muted)", fontSize: 14 }}
                    >
                      Punctuality, unit readiness, and payment flags will show
                      up here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginBottom: 4,
                      }}
                    >
                      <button
                        onClick={() => user && loadFlags(user)}
                        style={paginationBtnStyle(false)}
                      >
                        ↻ Refresh
                      </button>
                    </div>
                    {flags.map((f, i) => (
                      <div
                        key={i}
                        style={{
                          background: "var(--brand-surface)",
                          borderRadius: 16,
                          border: "1px solid var(--brand-border)",
                          padding: "16px 20px",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          boxShadow: `var(--shadow-s), inset 3px 0 0 ${
                            f.severity === "danger"
                              ? "var(--rausch)"
                              : "var(--amber)"
                          }`,
                        }}
                      >
                        <div style={{ fontSize: 22 }}>
                          {FLAG_META[f.type]?.icon || "🚩"}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color:
                                f.severity === "danger"
                                  ? "var(--rausch)"
                                  : "var(--amber)",
                              marginBottom: 3,
                            }}
                          >
                            {FLAG_META[f.type]?.label || f.type}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: "var(--brand-text)",
                            }}
                          >
                            {f.message}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Checklist (owner-managed template) ── */}
            {activeTab === "Checklist" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    background: "var(--brand-surface)",
                    borderRadius: 20,
                    boxShadow: "var(--shadow-s)",
                    border: "1px solid var(--brand-border)",
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "var(--brand-text)",
                      marginBottom: 14,
                    }}
                  >
                    New cleaning checklist
                  </div>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--brand-text-muted)",
                      marginBottom: 14,
                    }}
                  >
                    Applies to all units. Checkboxes reset fresh every day for
                    housekeeping.
                  </p>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Title</label>
                    <input
                      type="text"
                      value={newChecklistTitle}
                      onChange={(e) => setNewChecklistTitle(e.target.value)}
                      placeholder="e.g. Standard turnover checklist"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Items (one per line)</label>
                    <textarea
                      value={newChecklistItems}
                      onChange={(e) => setNewChecklistItems(e.target.value)}
                      placeholder={
                        "Strip and replace linens\nSanitize bathroom\nRestock toiletries\nVacuum floors\nCheck AC unit"
                      }
                      rows={5}
                      style={textareaStyle}
                    />
                  </div>
                  <button
                    onClick={handleCreateChecklist}
                    disabled={
                      creatingChecklist ||
                      !newChecklistTitle.trim() ||
                      !newChecklistItems.trim()
                    }
                    style={{
                      background:
                        creatingChecklist ||
                        !newChecklistTitle.trim() ||
                        !newChecklistItems.trim()
                          ? "var(--brand-border)"
                          : "var(--rausch)",
                      color:
                        creatingChecklist ||
                        !newChecklistTitle.trim() ||
                        !newChecklistItems.trim()
                          ? "var(--brand-text-muted)"
                          : "white",
                      border: "none",
                      borderRadius: 12,
                      padding: "11px 24px",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor:
                        creatingChecklist ||
                        !newChecklistTitle.trim() ||
                        !newChecklistItems.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {creatingChecklist ? "Creating..." : "+ Create checklist"}
                  </button>
                </div>

                {checklistLoading ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: "var(--brand-text-muted)",
                    }}
                  >
                    Loading checklists...
                  </div>
                ) : checklists.length === 0 ? (
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
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                    <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
                      No checklist yet
                    </h3>
                    <p
                      style={{ color: "var(--brand-text-muted)", fontSize: 14 }}
                    >
                      Create one above — housekeeping will see it for every
                      unit.
                    </p>
                  </div>
                ) : (
                  checklists.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: "var(--brand-surface)",
                        borderRadius: 20,
                        boxShadow: "var(--shadow-s)",
                        border: "1px solid var(--brand-border)",
                        padding: "20px 24px",
                      }}
                    >
                      {editingChecklistId === c.id ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            style={inputStyle}
                          />
                          <textarea
                            value={editItemsText}
                            onChange={(e) => setEditItemsText(e.target.value)}
                            rows={5}
                            style={textareaStyle}
                          />
                          <div style={{ display: "flex", gap: 10 }}>
                            <button
                              onClick={() => setEditingChecklistId(null)}
                              style={{
                                padding: "8px 18px",
                                border: "1px solid var(--brand-border)",
                                borderRadius: 10,
                                background: "var(--brand-surface)",
                                color: "var(--brand-text)",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveChecklist(c.id)}
                              disabled={savingChecklist}
                              style={{
                                padding: "8px 18px",
                                background: "var(--rausch)",
                                border: "none",
                                borderRadius: 10,
                                color: "white",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {savingChecklist ? "Saving..." : "Save changes"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 12,
                              flexWrap: "wrap",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 800,
                                color: "var(--brand-text)",
                              }}
                            >
                              {c.title}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => startEditChecklist(c)}
                                style={{
                                  padding: "5px 14px",
                                  borderRadius: 10,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  border: "1px solid var(--brand-border)",
                                  background: "var(--brand-surface)",
                                  color: "var(--brand-text)",
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteChecklist(c.id)}
                                style={{
                                  padding: "5px 14px",
                                  borderRadius: 10,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  border: "1px solid rgba(255,56,92,.3)",
                                  background: "rgba(255,56,92,.08)",
                                  color: "var(--rausch)",
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {[...c.ChecklistItem]
                              .sort((a, b) => a.sort_order - b.sort_order)
                              .map((item) => (
                                <div
                                  key={item.id}
                                  style={{
                                    fontSize: 13,
                                    color: "var(--brand-text-muted)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <span>☐</span> {item.label}
                                </div>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "Receivers" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    background: "var(--brand-surface)",
                    borderRadius: 20,
                    boxShadow: "var(--shadow-s)",
                    border: "1px solid var(--brand-border)",
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "var(--brand-text)",
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
                        border: "1px solid var(--brand-border)",
                        borderRadius: 12,
                        fontSize: 14,
                        color: "var(--brand-text)",
                        outline: "none",
                        fontFamily: "inherit",
                        background: "var(--brand-surface)",
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = "var(--rausch)")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor =
                          "var(--brand-border)")
                      }
                    />
                    <button
                      onClick={handleAddReceiver}
                      disabled={addingReceiver || !newReceiverName.trim()}
                      style={{
                        background:
                          addingReceiver || !newReceiverName.trim()
                            ? "var(--brand-border)"
                            : "var(--rausch)",
                        color:
                          addingReceiver || !newReceiverName.trim()
                            ? "var(--brand-text-muted)"
                            : "white",
                        border: "none",
                        borderRadius: 12,
                        padding: "11px 24px",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor:
                          addingReceiver || !newReceiverName.trim()
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {addingReceiver ? "Adding..." : "+ Add"}
                    </button>
                  </div>
                </div>

                {receivers.length === 0 ? (
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
                    <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
                    <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
                      No receivers yet
                    </h3>
                    <p
                      style={{ color: "var(--brand-text-muted)", fontSize: 14 }}
                    >
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
                          background: "var(--brand-surface)",
                          borderRadius: 16,
                          boxShadow: "var(--shadow-s)",
                          border: "1px solid var(--brand-border)",
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
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, var(--rausch), #C13584)",
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
                              fontWeight: 700,
                              color: "var(--brand-text)",
                            }}
                          >
                            {r.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveReceiver(r.id)}
                          style={{
                            padding: "5px 14px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            border: "1px solid rgba(255,56,92,.3)",
                            background: "rgba(255,56,92,.08)",
                            color: "var(--rausch)",
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

            {/* ── Employees ── */}
            {activeTab === "Employees" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {employees.length === 0 ? (
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
                    <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
                    <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
                      No employees yet
                    </h3>
                    <p
                      style={{ color: "var(--brand-text-muted)", fontSize: 14 }}
                    >
                      Invite your first team member using the button above.
                    </p>
                  </div>
                ) : (
                  employees.map((emp) => (
                    <div
                      key={emp.id}
                      style={{
                        background: "var(--brand-surface)",
                        borderRadius: 20,
                        boxShadow: "var(--shadow-s)",
                        border: "1px solid var(--brand-border)",
                        padding: "20px 24px",
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
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg, var(--rausch), #C13584)",
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
                                color: "var(--brand-text)",
                                fontSize: 15,
                                marginBottom: 3,
                              }}
                            >
                              {emp.name}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--brand-text-muted)",
                              }}
                            >
                              {emp.email}
                            </div>
                            {emp.invited_at && emp.status === "invited" && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--amber)",
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
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background: ROLE_COLORS[emp.role]?.bg,
                              color: ROLE_COLORS[emp.role]?.color,
                            }}
                          >
                            {emp.role}
                          </span>
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
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
                                borderRadius: 10,
                                fontSize: 12,
                                fontWeight: 700,
                                border: "1px solid rgba(0,138,5,.3)",
                                background: "rgba(0,138,5,.08)",
                                color: "var(--green)",
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
                                borderRadius: 10,
                                fontSize: 12,
                                fontWeight: 700,
                                border: "1px solid rgba(200,125,0,.3)",
                                background: "rgba(200,125,0,.08)",
                                color: "var(--amber)",
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
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 700,
                              border: "1px solid rgba(255,56,92,.3)",
                              background: "rgba(255,56,92,.08)",
                              color: "var(--rausch)",
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
                      No expenses recorded
                    </h3>
                    <p
                      style={{ color: "var(--brand-text-muted)", fontSize: 14 }}
                    >
                      Expenses added by housekeeping and auditors will appear
                      here.
                    </p>
                  </div>
                ) : (
                  expenseNotes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        background: "var(--brand-surface)",
                        borderRadius: 20,
                        border: "1px solid var(--brand-border)",
                        padding: "18px 24px",
                        boxShadow: `var(--shadow-s), inset 3px 0 0 ${
                          CATEGORY_COLORS[note.category]?.color ||
                          "var(--brand-border)"
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
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
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
                              fontWeight: 800,
                              color: "var(--brand-text)",
                            }}
                          >
                            {formatCurrency(Number(note.amount))}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: 14,
                          lineHeight: 1.65,
                          color: "var(--brand-text)",
                          marginBottom: 10,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {note.content}
                      </p>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--brand-text-muted)",
                        }}
                      >
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
                      background: "var(--brand-surface)",
                      borderRadius: 20,
                      padding: 60,
                      textAlign: "center",
                      boxShadow: "var(--shadow-s)",
                      border: "1px solid var(--brand-border)",
                    }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
                    <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
                      No payments yet
                    </h3>
                    <p
                      style={{ color: "var(--brand-text-muted)", fontSize: 14 }}
                    >
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
                          boxShadow: `var(--shadow-s), inset 3px 0 0 ${
                            STATUS_COLORS[p.status]?.color ||
                            "var(--brand-border)"
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
                                color: "var(--brand-text)",
                                fontSize: 15,
                                marginBottom: 4,
                              }}
                            >
                              {p.Booking?.guestName || "—"}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--brand-text-muted)",
                                marginBottom: 4,
                              }}
                            >
                              {p.Booking?.Property?.name || "—"} · {p.type}
                            </div>
                            {p.notes && (
                              <div
                                style={{
                                  fontSize: 13,
                                  color: "var(--brand-text-muted)",
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
                                fontWeight: 800,
                                color: "var(--brand-text)",
                                marginBottom: 6,
                              }}
                            >
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
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--brand-text-muted)",
                                  marginTop: 6,
                                }}
                              >
                                Paid {formatDate(p.paidAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        marginTop: 8,
                      }}
                    >
                      <button
                        onClick={() =>
                          setPaymentsPage((p) => Math.max(1, p - 1))
                        }
                        disabled={paymentsPage === 1}
                        style={paginationBtnStyle(paymentsPage === 1)}
                      >
                        ‹ Prev
                      </button>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--brand-text-muted)",
                        }}
                      >
                        Page {paymentsPage} of {totalPaymentsPages}
                      </span>
                      <button
                        onClick={() =>
                          setPaymentsPage((p) =>
                            Math.min(totalPaymentsPages, p + 1)
                          )
                        }
                        disabled={paymentsPage === totalPaymentsPages}
                        style={paginationBtnStyle(
                          paymentsPage === totalPaymentsPages
                        )}
                      >
                        Next ›
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Bookings ── */}
            {activeTab === "Bookings" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
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
                        border: "1px solid var(--brand-border)",
                        borderRadius: 12,
                        fontSize: 13,
                        color: "var(--brand-text)",
                        outline: "none",
                        background: "var(--brand-surface)",
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
                  </div>

                  <select
                    value={filterProperty}
                    onChange={(e) => setFilterProperty(e.target.value)}
                    style={{
                      padding: "9px 12px",
                      border: "1px solid var(--brand-border)",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--brand-text)",
                      background: "var(--brand-surface)",
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
                      border: "1px solid var(--brand-border)",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--brand-text)",
                      background: "var(--brand-surface)",
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
                      border: "1px solid var(--brand-border)",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--brand-text)",
                      background: "var(--brand-surface)",
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
                      border: "1px solid var(--brand-border)",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--brand-text)",
                      background: "var(--brand-surface)",
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
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        border: "1px solid rgba(255,56,92,.3)",
                        background: "rgba(255,56,92,.08)",
                        color: "var(--rausch)",
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
                      color: "var(--brand-text-muted)",
                    }}
                  >
                    No bookings found.
                  </div>
                ) : (
                  <>
                    {paginatedBookings.map((b) => {
                      const { downPayment, totalCost, balance } =
                        getBookingPaymentBreakdown(b);
                      return (
                        <div
                          key={b.id}
                          style={{
                            background: "var(--brand-surface)",
                            borderRadius: 20,
                            border: "1px solid var(--brand-border)",
                            padding: "20px 24px",
                            boxShadow: `var(--shadow-s), inset 3px 0 0 ${
                              STATUS_COLORS[b.status]?.color ||
                              "var(--brand-border)"
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
                              marginBottom: 16,
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
                                  borderRadius: "50%",
                                  background:
                                    "linear-gradient(135deg, var(--rausch), #C13584)",
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
                                    fontSize: 15,
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
                                {
                                  label: "Check-in",
                                  val: formatDate(b.checkIn),
                                },
                                {
                                  label: "Check-out",
                                  val: formatDate(b.checkOut),
                                },
                                {
                                  label: "Nights",
                                  val: String(nights(b.checkIn, b.checkOut)),
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
                              <span
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  background: STATUS_COLORS[b.status]?.bg,
                                  color: STATUS_COLORS[b.status]?.color,
                                }}
                              >
                                {b.status.replace("_", " ")}
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 20,
                              flexWrap: "wrap",
                              paddingTop: 14,
                              borderTop: "1px solid var(--brand-border)",
                            }}
                          >
                            {[
                              { label: "Total cost", val: totalCost },
                              { label: "Down payment", val: downPayment },
                              { label: "Balance", val: balance },
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
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color:
                                      item.label === "Balance" && item.val > 0
                                        ? "var(--rausch)"
                                        : "var(--brand-text)",
                                  }}
                                >
                                  {formatCurrency(item.val)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        marginTop: 8,
                      }}
                    >
                      <button
                        onClick={() =>
                          setBookingsPage((p) => Math.max(1, p - 1))
                        }
                        disabled={bookingsPage === 1}
                        style={paginationBtnStyle(bookingsPage === 1)}
                      >
                        ‹ Prev
                      </button>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--brand-text-muted)",
                        }}
                      >
                        Page {bookingsPage} of {totalBookingsPages}
                      </span>
                      <button
                        onClick={() =>
                          setBookingsPage((p) =>
                            Math.min(totalBookingsPages, p + 1)
                          )
                        }
                        disabled={bookingsPage === totalBookingsPages}
                        style={paginationBtnStyle(
                          bookingsPage === totalBookingsPages
                        )}
                      >
                        Next ›
                      </button>
                    </div>
                  </>
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
              maxWidth: 460,
              boxShadow: "var(--shadow)",
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
                  fontWeight: 800,
                  color: "var(--brand-text)",
                }}
              >
                Invite Employee
              </h2>
              <button
                onClick={() => setShowInviteForm(false)}
                style={{
                  background: "var(--brand-bg)",
                  border: "1px solid var(--brand-border)",
                  borderRadius: "50%",
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
                    (e.currentTarget.style.borderColor = "var(--rausch)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--brand-border)")
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
                    (e.currentTarget.style.borderColor = "var(--rausch)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--brand-border)")
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
                    background: "rgba(255,56,92,.08)",
                    border: "1px solid rgba(255,56,92,.3)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "var(--rausch)",
                  }}
                >
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div
                  style={{
                    background: "rgba(0,138,5,.08)",
                    border: "1px solid rgba(0,138,5,.3)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "var(--green)",
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
                  onClick={handleInvite}
                  disabled={
                    inviting || !inviteName.trim() || !inviteEmail.trim()
                  }
                  style={{
                    flex: 2,
                    padding: 12,
                    background:
                      inviting || !inviteName.trim() || !inviteEmail.trim()
                        ? "var(--brand-border)"
                        : "var(--rausch)",
                    border: "none",
                    borderRadius: 12,
                    color:
                      inviting || !inviteName.trim() || !inviteEmail.trim()
                        ? "var(--brand-text-muted)"
                        : "white",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor:
                      inviting || !inviteName.trim() || !inviteEmail.trim()
                        ? "not-allowed"
                        : "pointer",
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
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        :root {
          --rausch:#FF385C; --violet:#6C5CE7; --green:#008A05; --amber:#C87D00;
          --ink:#222222; --gray:#717171; --line:#EBEBEB; --line-2:#DDDDDD;
          --bg:#FFFFFF; --bg-2:#F7F7F7; --card:#FFFFFF; --nav-bg:rgba(255,255,255,.92);
          --shadow:0 6px 20px rgba(0,0,0,.10); --shadow-s:0 1px 2px rgba(0,0,0,.06);
          --brand-bg: var(--bg-2);
          --brand-surface: var(--card);
          --brand-text: var(--ink);
          --brand-text-muted: var(--gray);
          --brand-border: var(--line);
          --brand-accent: var(--rausch);
          --background: var(--bg);
        }
        [data-theme="dark"] {
          --ink:#F4F4F5; --gray:#A6A6AD; --line:#2C2C31; --line-2:#3A3A40;
          --bg:#131316; --bg-2:#1C1C20; --card:#1F1F23; --nav-bg:rgba(19,19,22,.9);
          --shadow:0 8px 24px rgba(0,0,0,.55); --shadow-s:0 1px 2px rgba(0,0,0,.5);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input::placeholder { color: var(--gray); }
        select option { background: var(--brand-surface); color: var(--brand-text); }
      `}</style>
    </div>
  );
}
