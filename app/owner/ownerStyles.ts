import type { CSSProperties } from "react";

export const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  booker: { bg: "rgba(24,119,242,.14)", color: "#1877F2" },
  auditor: { bg: "rgba(200,125,0,.15)", color: "var(--amber)" },
  housekeeping: { bg: "rgba(0,138,5,.13)", color: "var(--green)" },
  owner: { bg: "rgba(108,92,231,.16)", color: "var(--violet)" },
  ADMIN: { bg: "rgba(108,92,231,.16)", color: "var(--violet)" },
  STAFF: { bg: "rgba(24,119,242,.14)", color: "#1877F2" },
};

export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
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

export const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  general: { bg: "var(--bg-2)", color: "var(--gray)" },
  cleaning: { bg: "rgba(24,119,242,.14)", color: "#1877F2" },
  supplies: { bg: "rgba(200,125,0,.15)", color: "var(--amber)" },
  maintenance: { bg: "rgba(255,56,92,.14)", color: "var(--rausch)" },
  laundry: { bg: "rgba(0,138,5,.13)", color: "var(--green)" },
  other: { bg: "rgba(108,92,231,.16)", color: "var(--violet)" },
};

export const FLAG_META: Record<string, { icon: string; label: string }> = {
  PUNCTUALITY: { icon: "⏰", label: "Punctuality" },
  DIRTY_UNIT: { icon: "🧹", label: "Unit not ready" },
  UNPAID_BALANCE: { icon: "💸", label: "Unpaid balance" },
};

export const inputStyle: CSSProperties = {
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

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  lineHeight: 1.6,
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--brand-text)",
  marginBottom: 7,
};

export const paginationBtnStyle = (disabled: boolean): CSSProperties => ({
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

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export function nights(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function getBookingPaymentBreakdown(b: {
  totalFee: number | null;
  Payment?: { status: string; type: string; amount: number }[];
}) {
  const paidPayments = (b.Payment || []).filter((p) => p.status === "PAID");
  const downPayment = paidPayments
    .filter((p) => p.type === "DOWNPAYMENT")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalCost = Number(b.totalFee || 0);
  const balance = Math.max(0, totalCost - totalPaid);
  return { downPayment, totalPaid, totalCost, balance };
}

export function getBookingPaymentState(b: {
  totalFee: number | null;
  Payment?: { status: string; type: string; amount: number }[];
}) {
  const { totalPaid, totalCost } = getBookingPaymentBreakdown(b);
  if (totalPaid <= 0) return "UNPAID";
  if (totalPaid >= totalCost && totalCost > 0) return "FULLY_PAID";
  return "PARTIAL";
}
