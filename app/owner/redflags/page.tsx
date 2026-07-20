"use client";

import React from "react";
import { useOwnerData } from "../OwnerDataContext";
import { FLAG_META, paginationBtnStyle } from "../ownerStyles";

export default function OwnerRedflagsPage() {
  const { flags, flagsLoading, reloadFlags } = useOwnerData();

  return (
    <div>
      {flagsLoading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--brand-text-muted)" }}>Checking for issues...</div>
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
          <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>No issues right now</h3>
          <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
            Punctuality, unit readiness, and payment flags will show up here.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => reloadFlags()} style={paginationBtnStyle(false)}>
              ↻ Refresh
            </button>
          </div>
          <div className="alerts-owner">
            {flags.map((f, i) => (
              <div className="alert-owner" key={i}>
                <span className={`a-dot-owner ${f.severity === "danger" ? "crit" : "warn"}`} />
                <div className="a-body-owner">
                  <div className="a-title-owner">
                    {FLAG_META[f.type]?.icon || "🚩"} {FLAG_META[f.type]?.label || f.type}
                  </div>
                  <div className="a-desc-owner">{f.message}</div>
                </div>
                <span className="a-tag-owner">{f.severity === "danger" ? "Critical" : "Warning"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
