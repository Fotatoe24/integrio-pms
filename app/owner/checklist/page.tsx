"use client";

import React, { useEffect, useState } from "react";
import { useOwnerData } from "../OwnerDataContext";
import { inputStyle, textareaStyle, labelStyle } from "../ownerStyles";
import { ChecklistRow } from "../types";

export default function OwnerChecklistPage() {
  const { user } = useOwnerData();

  const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistItems, setNewChecklistItems] = useState("");
  const [creatingChecklist, setCreatingChecklist] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editItemsText, setEditItemsText] = useState("");
  const [savingChecklist, setSavingChecklist] = useState(false);

  useEffect(() => {
    if (user) loadChecklists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadChecklists() {
    if (!user) return;
    setChecklistLoading(true);
    try {
      const res = await fetch(`/api/owner/checklist?owner_id=${user.id}`);
      const json = await res.json();
      setChecklists(json.checklists || []);
    } catch {
      setChecklists([]);
    }
    setChecklistLoading(false);
  }

  async function handleCreateChecklist() {
    if (!newChecklistTitle.trim() || !user) return;
    const items = newChecklistItems.split("\n").map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) return;

    setCreatingChecklist(true);
    try {
      const res = await fetch("/api/owner/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: user.id, title: newChecklistTitle.trim(), items }),
      });
      if (res.ok) {
        setNewChecklistTitle("");
        setNewChecklistItems("");
        loadChecklists();
      }
    } finally {
      setCreatingChecklist(false);
    }
  }

  function startEditChecklist(c: ChecklistRow) {
    setEditingChecklistId(c.id);
    setEditTitle(c.title);
    setEditItemsText([...c.ChecklistItem].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.label).join("\n"));
  }

  async function handleSaveChecklist(id: string) {
    const items = editItemsText.split("\n").map((s) => s.trim()).filter(Boolean);
    setSavingChecklist(true);
    try {
      const res = await fetch("/api/owner/checklist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: editTitle.trim(), items }),
      });
      if (res.ok) {
        setEditingChecklistId(null);
        loadChecklists();
      }
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleDeleteChecklist(id: string) {
    if (!confirm("Remove this checklist? Housekeeping will no longer see it.")) return;
    const res = await fetch(`/api/owner/checklist?id=${id}`, { method: "DELETE" });
    if (res.ok) loadChecklists();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "var(--brand-surface)",
          borderRadius: 20,
          boxShadow: "var(--shadow-s)",
          border: "1px solid var(--brand-border)",
          padding: "24px",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--brand-text)", marginBottom: 14 }}>New cleaning checklist</div>
        <p style={{ fontSize: 12.5, color: "var(--brand-text-muted)", marginBottom: 14 }}>
          Applies to all units. Checkboxes reset fresh every day for housekeeping.
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
            placeholder={"Strip and replace linens\nSanitize bathroom\nRestock toiletries\nVacuum floors\nCheck AC unit"}
            rows={5}
            style={textareaStyle}
          />
        </div>
        <button
          onClick={handleCreateChecklist}
          disabled={creatingChecklist || !newChecklistTitle.trim() || !newChecklistItems.trim()}
          style={{
            background: creatingChecklist || !newChecklistTitle.trim() || !newChecklistItems.trim() ? "var(--brand-border)" : "var(--rausch)",
            color: creatingChecklist || !newChecklistTitle.trim() || !newChecklistItems.trim() ? "var(--brand-text-muted)" : "white",
            border: "none",
            borderRadius: 12,
            padding: "11px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: creatingChecklist || !newChecklistTitle.trim() || !newChecklistItems.trim() ? "not-allowed" : "pointer",
          }}
        >
          {creatingChecklist ? "Creating..." : "+ Create checklist"}
        </button>
      </div>

      {checklistLoading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--brand-text-muted)" }}>Loading checklists...</div>
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
          <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>No checklist yet</h3>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Create one above — housekeeping will see it for every unit.
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
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputStyle} />
                <textarea value={editItemsText} onChange={(e) => setEditItemsText(e.target.value)} rows={5} style={textareaStyle} />
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--brand-text)" }}>{c.title}</div>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...c.ChecklistItem]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((item) => (
                      <div key={item.id} style={{ fontSize: 13, color: "var(--brand-text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
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
  );
}
