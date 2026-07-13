"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRole, IntegrioUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Tab = "Schedule" | "Checklist" | "Expenses";
type ScheduleRange = "soon" | "week";

interface ExpenseNote {
  id: string;
  content: string;
  category: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  created_by: string;
}

interface Property {
  id: string;
  name: string;
}

interface CheckoutItem {
  id: string;
  propertyId: string;
  guestName: string;
  checkOut: string;
  date: string;
  isToday: boolean;
  isTomorrow: boolean;
  Property?: { name: string };
}

interface CheckinItem {
  id: string;
  propertyId: string;
  guestName: string;
  contactNo: string | null;
  checkIn: string;
  date: string;
  isToday: boolean;
  isTomorrow: boolean;
  totalFee: number | null;
  balance: number;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  unitReady: boolean;
  unitNotReadyFlag: boolean;
}

interface ChecklistItemRow {
  id: string;
  label: string;
  sort_order: number;
}

interface InstanceItemRow {
  id: string;
  checklistItemId: string;
  is_checked: boolean;
}

const CATEGORIES = [
  "general",
  "cleaning",
  "supplies",
  "maintenance",
  "laundry",
  "other",
];

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  general: { bg: "#e2e3e5", color: "#383d41" },
  cleaning: { bg: "#d1ecf1", color: "#0c5460" },
  supplies: { bg: "#fff3cd", color: "#856404" },
  maintenance: { bg: "#f8d7da", color: "#721c24" },
  laundry: { bg: "#d4edda", color: "#155724" },
  other: { bg: "#e8d5f5", color: "#5a2d82" },
};

const PAYMENT_COLORS: Record<string, { bg: string; color: string }> = {
  PAID: { bg: "#d4edda", color: "#155724" },
  PARTIAL: { bg: "#fff3cd", color: "#856404" },
  UNPAID: { bg: "#f8d7da", color: "#721c24" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default function HousekeepingPage() {
  const router = useRouter();
  const [user, setUser] = useState<IntegrioUser | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Schedule");
  const [loading, setLoading] = useState(true);

  // Time in/out — read-only badge. time_in is set the moment they log in;
  // time_out is a fixed 5:00 PM Manila marker written at the same time,
  // not a live event. No button, nothing to click here.
  const [timeIn, setTimeIn] = useState<string | null>(null);
  const [timeOut, setTimeOut] = useState<string | null>(null);
  const [isLate, setIsLate] = useState(false);

  // Schedule
  const [scheduleRange, setScheduleRange] = useState<ScheduleRange>("soon");
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [checkouts, setCheckouts] = useState<CheckoutItem[]>([]);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);

  // Checklist
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [checklistTitle, setChecklistTitle] = useState<string>("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItemRow[]>([]);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [instanceItems, setInstanceItems] = useState<InstanceItemRow[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [noActiveChecklist, setNoActiveChecklist] = useState(false);

  // Expenses
  const [notes, setNotes] = useState<ExpenseNote[]>([]);
  const [expLoading, setExpLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    document.title = "Housekeeping — Integrio";
    const u = requireRole(["housekeeping"], router);
    if (u) {
      setUser(u);
      loadEverything(u);
    }
  }, []);

  async function loadEverything(u: IntegrioUser) {
    setLoading(true);

    // Read-only fetch — does NOT create or modify a log. Clock-in already
    // happened at login (see login page). This just powers the badge.
    try {
      const res = await fetch(`/api/housekeeping/login-log?userId=${u.id}`);
      const log = await res.json();
      if (log) {
        setTimeIn(log.time_in);
        setTimeOut(log.time_out);
        setIsLate(log.is_late);
      }
    } catch {
      // non-blocking
    }

    await Promise.all([loadSchedule(u, "soon"), loadExpenses(u)]);
    setLoading(false);
  }

  async function loadSchedule(u: IntegrioUser, range: ScheduleRange) {
    setScheduleLoading(true);
    const ownerId = u.owner_id ?? u.id;
    const days = range === "week" ? 7 : 1;
    try {
      const res = await fetch(
        `/api/housekeeping/schedule?owner_id=${ownerId}&days=${days}`
      );
      const json = await res.json();
      setProperties(json.properties || []);
      setCheckouts(json.checkouts || []);
      setCheckins(json.checkins || []);
      if (!selectedPropertyId && json.properties?.length) {
        setSelectedPropertyId(json.properties[0].id);
      }
    } catch {
      setProperties([]);
      setCheckouts([]);
      setCheckins([]);
    }
    setScheduleLoading(false);
  }

  function switchScheduleRange(range: ScheduleRange) {
    setScheduleRange(range);
    if (user) loadSchedule(user, range);
  }

  async function loadChecklist(u: IntegrioUser, propertyId: string) {
    if (!propertyId) return;
    setChecklistLoading(true);
    setNoActiveChecklist(false);
    const ownerId = u.owner_id ?? u.id;
    try {
      const res = await fetch(
        `/api/housekeeping/checklist?owner_id=${ownerId}&propertyId=${propertyId}`
      );
      const json = await res.json();
      if (!json.checklist) {
        setNoActiveChecklist(true);
        setChecklistItems([]);
        setInstanceItems([]);
        setInstanceId(null);
      } else {
        setChecklistTitle(json.checklist.title);
        setChecklistItems(json.items || []);
        setInstanceId(json.instance?.id || null);
        setInstanceItems(json.instance?.ChecklistInstanceItem || []);
      }
    } catch {
      setNoActiveChecklist(true);
    }
    setChecklistLoading(false);
  }

  useEffect(() => {
    if (user && selectedPropertyId && activeTab === "Checklist") {
      loadChecklist(user, selectedPropertyId);
    }
  }, [selectedPropertyId, activeTab]);

  async function toggleChecklistItem(
    checklistItemId: string,
    currentlyChecked: boolean
  ) {
    if (!user || !instanceId) return;
    const instanceItem = instanceItems.find(
      (i) => i.checklistItemId === checklistItemId
    );
    if (!instanceItem) return;

    const nextChecked = !currentlyChecked;
    setInstanceItems((prev) =>
      prev.map((i) =>
        i.checklistItemId === checklistItemId
          ? { ...i, is_checked: nextChecked }
          : i
      )
    );

    try {
      await fetch("/api/housekeeping/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceItemId: instanceItem.id,
          isChecked: nextChecked,
          userId: user.id,
          instanceId,
        }),
      });
      // Refresh schedule so "unit ready" flags update once all items are checked
      if (nextChecked) loadSchedule(user, scheduleRange);
    } catch {
      setInstanceItems((prev) =>
        prev.map((i) =>
          i.checklistItemId === checklistItemId
            ? { ...i, is_checked: currentlyChecked }
            : i
        )
      );
    }
  }

  // ── Expense notes ─────────────────────────────────────────────────────

  async function loadExpenses(u: IntegrioUser) {
    setExpLoading(true);
    const ownerId = u.owner_id ?? u.id;
    const { data, error } = await supabase
      .from("ExpenseNote")
      .select("*")
      .eq("owner_id", ownerId)
      .order("createdAt", { ascending: false });
    if (!error && data) setNotes(data);
    setExpLoading(false);
  }

  async function handleAddExpense() {
    if (!content.trim() || !user) return;
    setSubmitting(true);
    const ownerId = user.owner_id ?? user.id;
    const { data, error } = await supabase
      .from("ExpenseNote")
      .insert({
        owner_id: ownerId,
        created_by: user.id,
        content: content.trim(),
        category,
        amount: parseFloat(amount) || 0,
      })
      .select()
      .single();
    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setContent("");
      setCategory("general");
      setAmount("");
    }
    setSubmitting(false);
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("ExpenseNote").delete().eq("id", id);
    if (!error) setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function logout() {
    localStorage.removeItem("integrio_user");
    document.cookie = "auth-token=; max-age=0; path=/";
    window.location.href = "/login";
  }

  const propertyName = (propertyId: string) =>
    properties.find((p) => p.id === propertyId)?.name || "Unit";

  const checkoutsGrouped = useMemo(() => {
    const today = checkouts.filter((c) => c.isToday);
    const tomorrow = checkouts.filter((c) => c.isTomorrow);
    const rest = checkouts.filter((c) => !c.isToday && !c.isTomorrow);
    return { today, tomorrow, rest };
  }, [checkouts]);

  const checkinFlags = checkins.filter((c) => c.unitNotReadyFlag);

  const TABS: Tab[] = ["Schedule", "Checklist", "Expenses"];

  const cardStyle: React.CSSProperties = {
    background: "var(--brand-surface)",
    border: "1px solid var(--brand-border)",
    borderRadius: 16,
    boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
  };

  const pillButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    background: active ? "var(--brand-text)" : "var(--brand-surface)",
    color: active ? "var(--background)" : "var(--brand-text-muted)",
  });

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--brand-bg)",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--brand-surface)",
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
              fontWeight: 600,
              background: "#d1ecf1",
              color: "#0c5460",
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            Housekeeping
          </span>

          {/* Time in/out badge — read-only, no button */}
          {timeIn && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                background: isLate ? "#fff3cd" : "#d4edda",
                color: isLate ? "#856404" : "#155724",
                borderRadius: 20,
                padding: "3px 12px",
              }}
            >
              {isLate ? "⏰ Late in" : "✓ On time"} {formatTime(timeIn)} · Out{" "}
              {formatTime(timeOut)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "var(--brand-text)" }}>
            {user.name}
          </span>

          <a
            href="/settings"
            style={{
              fontSize: 13,
              color: "var(--brand-text)",
              border: "1.5px solid var(--brand-border)",
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
              color: "var(--brand-text-muted)",
              background: "none",
              border: "1.5px solid var(--brand-border)",
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
        style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}
      >
        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--brand-text)",
              marginBottom: 4,
            }}
          >
            Today's Work
          </h1>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Schedule, checklist, and expense notes
          </p>
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
                border:
                  activeTab === tab
                    ? "none"
                    : "1.5px solid var(--brand-border)",
                background:
                  activeTab === tab
                    ? "var(--brand-text)"
                    : "var(--brand-surface)",
                color:
                  activeTab === tab
                    ? "var(--background)"
                    : "var(--brand-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab}
              {tab === "Schedule" && checkinFlags.length > 0 && (
                <span
                  style={{
                    background:
                      activeTab === tab ? "var(--brand-bg)" : "#e74c3c",
                    color: activeTab === tab ? "var(--brand-text)" : "white",
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    minWidth: 16,
                    textAlign: "center",
                  }}
                >
                  {checkinFlags.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 60,
              color: "var(--brand-text-muted)",
            }}
          >
            Loading...
          </div>
        ) : (
          <>
            {/* ── Schedule ── */}
            {activeTab === "Schedule" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 24 }}
              >
                {/* Range toggle */}
                <div
                  style={{
                    display: "flex",
                    border: "1.5px solid var(--brand-border)",
                    borderRadius: 10,
                    overflow: "hidden",
                    width: "fit-content",
                  }}
                >
                  <button
                    style={pillButtonStyle(scheduleRange === "soon")}
                    onClick={() => switchScheduleRange("soon")}
                  >
                    Today &amp; Tomorrow
                  </button>
                  <button
                    style={pillButtonStyle(scheduleRange === "week")}
                    onClick={() => switchScheduleRange("week")}
                  >
                    This Week
                  </button>
                </div>

                {scheduleLoading ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: "var(--brand-text-muted)",
                    }}
                  >
                    Loading schedule...
                  </div>
                ) : (
                  <>
                    {/* Guests checking in */}
                    <div style={{ ...cardStyle, padding: "22px 24px" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--brand-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 16,
                        }}
                      >
                        Checking in — Today &amp; Tomorrow
                      </div>
                      {checkins.length === 0 ? (
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--brand-text-muted)",
                          }}
                        >
                          No check-ins today or tomorrow.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          {checkins.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                border: `1.5px solid ${
                                  c.unitNotReadyFlag
                                    ? "#e74c3c"
                                    : "var(--brand-border)"
                                }`,
                                borderRadius: 12,
                                padding: "14px 16px",
                                background: c.isToday
                                  ? "rgba(163,230,53,0.06)"
                                  : "transparent",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  flexWrap: "wrap",
                                  gap: 10,
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: 14,
                                      color: "var(--brand-text)",
                                      marginBottom: 3,
                                    }}
                                  >
                                    {c.guestName}
                                    <span
                                      style={{
                                        marginLeft: 8,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: "2px 8px",
                                        borderRadius: 20,
                                        background: c.isToday
                                          ? "#a3e635"
                                          : "var(--brand-border)",
                                        color: c.isToday
                                          ? "#0a0a0c"
                                          : "var(--brand-text-muted)",
                                      }}
                                    >
                                      {c.isToday ? "Today" : "Tomorrow"}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: "var(--brand-text-muted)",
                                    }}
                                  >
                                    🏠 {propertyName(c.propertyId)} ·{" "}
                                    {c.contactNo || "No contact"}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <span
                                    style={{
                                      padding: "3px 10px",
                                      borderRadius: 20,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      background:
                                        PAYMENT_COLORS[c.paymentStatus]?.bg,
                                      color:
                                        PAYMENT_COLORS[c.paymentStatus]?.color,
                                    }}
                                  >
                                    {c.paymentStatus}
                                  </span>
                                  {c.balance > 0 && (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: "#e74c3c",
                                        fontWeight: 600,
                                        marginTop: 4,
                                      }}
                                    >
                                      {formatCurrency(c.balance)} due
                                    </div>
                                  )}
                                </div>
                              </div>
                              {c.unitNotReadyFlag && (
                                <div
                                  style={{
                                    marginTop: 10,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#e74c3c",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  ⚠️ Unit not cleaned yet — finish the checklist
                                  before this guest arrives
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Checkouts */}
                    <div style={{ ...cardStyle, padding: "22px 24px" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--brand-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 16,
                        }}
                      >
                        Checkouts to clean —{" "}
                        {scheduleRange === "week"
                          ? "This week"
                          : "Today & tomorrow"}
                      </div>

                      {checkouts.length === 0 ? (
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--brand-text-muted)",
                          }}
                        >
                          No checkouts scheduled.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          {[
                            ...checkoutsGrouped.today,
                            ...checkoutsGrouped.tomorrow,
                            ...checkoutsGrouped.rest,
                          ].map((c) => (
                            <div
                              key={c.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                border: "1.5px solid var(--brand-border)",
                                borderRadius: 12,
                                padding: "12px 16px",
                                background: c.isToday
                                  ? "rgba(163,230,53,0.06)"
                                  : c.isTomorrow
                                  ? "rgba(255,243,205,0.06)"
                                  : "transparent",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 14,
                                    color: "var(--brand-text)",
                                  }}
                                >
                                  {propertyName(c.propertyId)} · {c.guestName}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--brand-text-muted)",
                                  }}
                                >
                                  {formatDate(c.checkOut)}
                                </div>
                              </div>
                              {(c.isToday || c.isTomorrow) && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "3px 10px",
                                    borderRadius: 20,
                                    background: c.isToday
                                      ? "#a3e635"
                                      : "#fff3cd",
                                    color: c.isToday ? "#0a0a0c" : "#856404",
                                  }}
                                >
                                  {c.isToday ? "TODAY" : "TOMORROW"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Checklist ── */}
            {activeTab === "Checklist" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {properties.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPropertyId(p.id)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        border:
                          selectedPropertyId === p.id
                            ? "none"
                            : "1.5px solid var(--brand-border)",
                        background:
                          selectedPropertyId === p.id
                            ? "linear-gradient(135deg, #1a2744, #2cb5b0)"
                            : "var(--brand-surface)",
                        color:
                          selectedPropertyId === p.id
                            ? "white"
                            : "var(--brand-text)",
                        cursor: "pointer",
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <div style={{ ...cardStyle, padding: "22px 24px" }}>
                  {checklistLoading ? (
                    <p
                      style={{ fontSize: 13, color: "var(--brand-text-muted)" }}
                    >
                      Loading checklist...
                    </p>
                  ) : noActiveChecklist ? (
                    <div style={{ textAlign: "center", padding: 30 }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--brand-text-muted)",
                        }}
                      >
                        No checklist has been set up by the owner yet.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--brand-text)",
                          marginBottom: 4,
                        }}
                      >
                        {checklistTitle}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--brand-text-muted)",
                          marginBottom: 18,
                        }}
                      >
                        {propertyName(selectedPropertyId)} · Resets fresh every
                        day
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {checklistItems
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((item) => {
                            const state = instanceItems.find(
                              (i) => i.checklistItemId === item.id
                            );
                            const checked = state?.is_checked || false;
                            return (
                              <label
                                key={item.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  padding: "12px 8px",
                                  borderRadius: 10,
                                  cursor: "pointer",
                                  borderBottom: "1px solid var(--background)",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    toggleChecklistItem(item.id, checked)
                                  }
                                  style={{
                                    width: 18,
                                    height: 18,
                                    cursor: "pointer",
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 14,
                                    color: checked
                                      ? "var(--brand-text-muted)"
                                      : "var(--brand-text)",
                                    textDecoration: checked
                                      ? "line-through"
                                      : "none",
                                  }}
                                >
                                  {item.label}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                      {checklistItems.length > 0 &&
                        instanceItems.length > 0 &&
                        instanceItems.every((i) => i.is_checked) && (
                          <div
                            style={{
                              marginTop: 16,
                              padding: "10px 14px",
                              background: "#d4edda",
                              color: "#155724",
                              borderRadius: 10,
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            ✓ Unit marked ready — next guest can check in
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Expenses ── */}
            {activeTab === "Expenses" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 24 }}
              >
                {/* Add note card */}
                <div style={{ ...cardStyle, padding: "24px" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--brand-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 14,
                    }}
                  >
                    New expense note
                  </div>

                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Describe the expense — what was purchased, where, quantity..."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      border: "1.5px solid var(--brand-border)",
                      borderRadius: 10,
                      fontSize: 14,
                      color: "var(--brand-text)",
                      background: "var(--brand-surface)",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                      marginBottom: 12,
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
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        padding: "9px 12px",
                        border: "1.5px solid var(--brand-border)",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "var(--brand-text)",
                        background: "var(--brand-surface)",
                        outline: "none",
                        cursor: "pointer",
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
                        border: "1.5px solid var(--brand-border)",
                        borderRadius: 8,
                        padding: "0 12px",
                        gap: 4,
                        background: "var(--brand-surface)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--brand-text-muted)",
                        }}
                      >
                        ₱
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        style={{
                          border: "none",
                          outline: "none",
                          fontSize: 14,
                          color: "var(--brand-text)",
                          background: "transparent",
                          width: 90,
                          padding: "9px 0",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>

                    <button
                      onClick={handleAddExpense}
                      disabled={submitting || !content.trim()}
                      style={{
                        marginLeft: "auto",
                        background:
                          submitting || !content.trim()
                            ? "var(--brand-border)"
                            : "linear-gradient(135deg, #1a2744, #2cb5b0)",
                        color:
                          submitting || !content.trim()
                            ? "var(--brand-text-muted)"
                            : "white",
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 20px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor:
                          submitting || !content.trim()
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {submitting ? "Adding..." : "+ Add note"}
                    </button>
                  </div>
                </div>

                {/* Notes feed */}
                {expLoading ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 40,
                      color: "var(--brand-text-muted)",
                    }}
                  >
                    Loading notes...
                  </div>
                ) : notes.length === 0 ? (
                  <div
                    style={{ ...cardStyle, padding: 60, textAlign: "center" }}
                  >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🧹</div>
                    <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
                      No notes yet
                    </h3>
                    <p
                      style={{ color: "var(--brand-text-muted)", fontSize: 14 }}
                    >
                      Add your first expense note above.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          ...cardStyle,
                          padding: "20px 24px",
                          borderLeft: `4px solid ${
                            CATEGORY_COLORS[note.category]?.bg ||
                            "var(--brand-border)"
                          }`,
                        }}
                      >
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
                            marginBottom: 14,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {note.content}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--brand-text-muted)",
                            }}
                          >
                            {formatDateTime(note.createdAt)}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(note.id)}
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
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: var(--brand-surface); color: var(--brand-text); }
      `}</style>
    </div>
  );
}
