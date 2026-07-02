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

export default function HousekeepingPage() {
  const router = useRouter();
  const [user, setUser] = useState<IntegrioUser | null>(null);
  const [notes, setNotes] = useState<ExpenseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [amount, setAmount] = useState("");

  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [editAmount, setEditAmount] = useState("");

  // Filters
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => {
    document.title = "Housekeeping — Integrio";
    const u = requireRole(["housekeeping"], router);
    if (u) {
      setUser(u);
      fetchNotes(u);
    }
  }, []);

  async function fetchNotes(u: IntegrioUser) {
    setLoading(true);
    const ownerId = u.owner_id ?? u.id;
    const { data, error } = await supabase
      .from("ExpenseNote")
      .select("*")
      .eq("owner_id", ownerId)
      .order("createdAt", { ascending: false });
    if (!error && data) setNotes(data);
    setLoading(false);
  }

  async function handleAdd() {
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
      setNotes((prev) => prev.map((n) => (n.id === id ? data : n)));
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("ExpenseNote").delete().eq("id", id);
    if (!error) setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function formatDate(iso: string) {
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

  const hasActiveFilters =
    filterCategory !== "all" ||
    filterSearch.trim() !== "" ||
    filterDateFrom !== "" ||
    filterDateTo !== "";

  function clearFilters() {
    setFilterCategory("all");
    setFilterSearch("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (filterCategory !== "all" && note.category !== filterCategory) {
        return false;
      }

      if (
        filterSearch.trim() &&
        !note.content.toLowerCase().includes(filterSearch.trim().toLowerCase())
      ) {
        return false;
      }

      const noteDate = new Date(note.createdAt);

      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        from.setHours(0, 0, 0, 0);
        if (noteDate < from) return false;
      }

      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999);
        if (noteDate > to) return false;
      }

      return true;
    });
  }, [notes, filterCategory, filterSearch, filterDateFrom, filterDateTo]);

  const totalAmount = filteredNotes.reduce(
    (sum, n) => sum + Number(n.amount || 0),
    0
  );

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
          {/* Logo — swaps with theme via Tailwind's dark: variant */}
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
        style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}
      >
        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--bra-text)",
              marginBottom: 4,
            }}
          >
            Expense Notes
          </h1>
          <p style={{ color: "#8896a5", fontSize: 14 }}>
            {filteredNotes.length}{" "}
            {filteredNotes.length === 1 ? "entry" : "entries"}
            {hasActiveFilters ? ` of ${notes.length}` : ""} · Total: ₱
            {totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Add note card */}
        <div
          style={{
            background: "var(--accent, white)",
            borderRadius: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            padding: "24px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#8896a5",
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
              border: "1.5px solid #e8edf3",
              borderRadius: 10,
              fontSize: 14,
              color: "var(--brand-text)",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              marginBottom: 12,
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#2cb5b0")}
            onBlur={(e) => (e.target.style.borderColor = "#e8edf3")}
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
                border: "1.5px solid #e8edf3",
                borderRadius: 8,
                fontSize: 13,
                color: "#var(--brand-text)",
                background: "var(--accent, white)",
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
                border: "1.5px solid #e8edf3",
                borderRadius: 8,
                padding: "0 12px",
                gap: 4,
                background: "var(--accent, white)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--brand-text-muted)" }}>
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
                  width: 90,
                  padding: "9px 0",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={submitting || !content.trim()}
              style={{
                marginLeft: "auto",
                background:
                  submitting || !content.trim()
                    ? "#e8edf3"
                    : "linear-gradient(135deg, #1a2744, #2cb5b0)",
                color: submitting || !content.trim() ? "#8896a5" : "white",
                border: "none",
                borderRadius: 8,
                padding: "9px 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  submitting || !content.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow:
                  submitting || !content.trim()
                    ? "none"
                    : "0 4px 16px rgba(44,181,176,0.3)",
                transition: "all 0.2s",
              }}
            >
              {submitting ? (
                <span
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
              ) : (
                "+ Add note"
              )}
            </button>
          </div>
        </div>

        {/* Filter card */}
        <div
          style={{
            background: "var(--accent, white)",
            borderRadius: 16,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            padding: "20px 24px",
            marginBottom: 24,
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
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#8896a5",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Filters
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#2cb5b0",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Clear all
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Search notes..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{
                flex: "1 1 180px",
                padding: "9px 12px",
                border: "1.5px solid #e8edf3",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--brand-text)",
                background: "var(--accent, white)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                padding: "9px 12px",
                border: "1.5px solid #e8edf3",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--brand-text)",
                background: "var(--accent, white)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="all">All categories</option>
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
                gap: 6,
              }}
            >
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1.5px solid #e8edf3",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--brand-text)",
                  background: "var(--accent, white)",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <span style={{ fontSize: 12, color: "#8896a5" }}>to</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1.5px solid #e8edf3",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--brand-text)",
                  background: "var(--accent, white)",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </div>

        {/* Feed label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#8896a5",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Expense log
          </span>
          <span style={{ fontSize: 12, color: "#8896a5" }}>Latest first</span>
        </div>

        {/* Notes feed */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
            Loading notes...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div
            style={{
              background: "var(--accent, white)",
              borderRadius: 16,
              padding: 60,
              textAlign: "center",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧹</div>
            <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>
              {hasActiveFilters ? "No matching notes" : "No notes yet"}
            </h3>
            <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
              {hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "Add your first expense note above."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  background: "var(--accent, white)",
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
                        width: "100%",
                        padding: "11px 14px",
                        border: "1.5px solid #2cb5b0",
                        borderRadius: 10,
                        fontSize: 14,
                        color: "var(--brand-text)",
                        outline: "none",
                        resize: "vertical",
                        fontFamily: "inherit",
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
                          color: "var(--brand-text)",
                          background: "var(--brand-surface)",
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
                            color: "var(--brand-text-muted)",
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
                            color: "var(--brand-text)",
                            width: 90,
                            padding: "8px 0",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <div
                        style={{ marginLeft: "auto", display: "flex", gap: 8 }}
                      >
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            padding: "7px 16px",
                            border: "1.5px solid #e8edf3",
                            borderRadius: 8,
                            background: "var(--brand-surface)",
                            color: "var(--brand-text)",
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
                          background:
                            CATEGORY_COLORS[note.category]?.bg || "#e2e3e5",
                          color:
                            CATEGORY_COLORS[note.category]?.color || "#383d41",
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
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 12, color: "#8896a5" }}>
                        {formatDate(note.createdAt)}
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
                            background: "var(--brand-surface)",
                            color: "var(--brand-text)",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
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
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea:focus { border-color: #2cb5b0 !important; }
        select:focus { border-color: #2cb5b0 !important; outline: none; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
}
