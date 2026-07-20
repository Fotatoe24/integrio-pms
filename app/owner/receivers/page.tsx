"use client";

import React, { useState } from "react";
import { useOwnerData } from "../OwnerDataContext";

export default function OwnerReceiversPage() {
  const { receivers, addReceiver, removeReceiver } = useOwnerData();
  const [newReceiverName, setNewReceiverName] = useState("");
  const [addingReceiver, setAddingReceiver] = useState(false);

  async function handleAddReceiver() {
    if (!newReceiverName.trim()) return;
    setAddingReceiver(true);
    const ok = await addReceiver(newReceiverName);
    if (ok) setNewReceiverName("");
    setAddingReceiver(false);
  }

  async function handleRemoveReceiver(id: string) {
    if (!confirm("Remove this receiver?")) return;
    await removeReceiver(id);
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
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--brand-text)", marginBottom: 14 }}>Add money receiver</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            value={newReceiverName}
            onChange={(e) => setNewReceiverName(e.target.value)}
            placeholder="e.g. Sir James, Ate Rosa"
            onKeyDown={(e) => e.key === "Enter" && handleAddReceiver()}
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
          />
          <button
            onClick={handleAddReceiver}
            disabled={addingReceiver || !newReceiverName.trim()}
            style={{
              background: addingReceiver || !newReceiverName.trim() ? "var(--brand-border)" : "var(--rausch)",
              color: addingReceiver || !newReceiverName.trim() ? "var(--brand-text-muted)" : "white",
              border: "none",
              borderRadius: 12,
              padding: "11px 24px",
              fontSize: 14,
              fontWeight: 700,
              cursor: addingReceiver || !newReceiverName.trim() ? "not-allowed" : "pointer",
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
          <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>No receivers yet</h3>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>Add the people who collect payments.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="m-av-owner">{r.name.charAt(0).toUpperCase()}</div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--brand-text)" }}>{r.name}</span>
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
  );
}
