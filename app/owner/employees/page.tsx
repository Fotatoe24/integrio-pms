"use client";

import React, { useState } from "react";
import { useOwnerData } from "../OwnerDataContext";
import { ROLE_COLORS, STATUS_COLORS, inputStyle, labelStyle, formatDateTime } from "../ownerStyles";
import { ROLES, Employee } from "../types";

export default function OwnerEmployeesPage() {
  const { employees, inviteEmployee, revokeEmployee, reactivateEmployee, removeEmployee } = useOwnerData();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("booker");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    const result = await inviteEmployee({ name: inviteName, email: inviteEmail, role: inviteRole });
    if (!result.ok) {
      setInviteError(result.error || "Failed to send invite.");
    } else {
      setInviteSuccess(`Invite sent to ${inviteEmail}`);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("booker");
      setTimeout(() => {
        setShowInviteForm(false);
        setInviteSuccess("");
      }, 2000);
    }
    setInviting(false);
  }

  async function handleRevoke(emp: Employee) {
    if (!confirm(`Revoke access for ${emp.name}? They will no longer be able to log in.`)) return;
    await revokeEmployee(emp);
  }

  async function handleRemove(emp: Employee) {
    if (!confirm(`Permanently remove ${emp.name}? This cannot be undone.`)) return;
    await removeEmployee(emp);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
            <h3 style={{ color: "var(--brand-text)", marginBottom: 8 }}>No employees yet</h3>
            <p style={{ color: "var(--brand-text-muted)", fontSize: 14 }}>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="m-av-owner" style={{ width: 44, height: 44, fontSize: 18 }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--brand-text)", fontSize: 15, marginBottom: 3 }}>{emp.name}</div>
                    <div style={{ fontSize: 13, color: "var(--brand-text-muted)" }}>{emp.email}</div>
                    {emp.invited_at && emp.status === "invited" && (
                      <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 2 }}>
                        Invited {formatDateTime(emp.invited_at)} · Awaiting first login
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
                      onClick={() => reactivateEmployee(emp)}
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
          <div style={{ background: "var(--brand-surface)", borderRadius: 20, padding: 36, width: "100%", maxWidth: 460, boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--brand-text)" }}>Invite Employee</h2>
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
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Maria Santos" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email address *</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="maria@example.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role *</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={inputStyle}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {inviteError && (
                <div style={{ background: "rgba(255,56,92,.08)", border: "1px solid rgba(255,56,92,.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--rausch)" }}>
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div style={{ background: "rgba(0,138,5,.08)", border: "1px solid rgba(0,138,5,.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--green)" }}>
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
                  disabled={inviting || !inviteName.trim() || !inviteEmail.trim()}
                  style={{
                    flex: 2,
                    padding: 12,
                    background: inviting || !inviteName.trim() || !inviteEmail.trim() ? "var(--brand-border)" : "var(--rausch)",
                    border: "none",
                    borderRadius: 12,
                    color: inviting || !inviteName.trim() || !inviteEmail.trim() ? "var(--brand-text-muted)" : "white",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: inviting || !inviteName.trim() || !inviteEmail.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {inviting ? "Sending invite..." : "Send invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
