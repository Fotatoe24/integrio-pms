import type { Booking, ExpenseNote, Payment } from "./types";

export type OverviewMode = "week" | "month" | "year";

export function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function endOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

export function getWeekRange(base: Date, offset: number = 0): [Date, Date] {
  const d = new Date(base);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [startOfDay(monday), endOfDay(sunday)];
}

export function getMonthRange(base: Date, offset: number): [Date, Date] {
  const start = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const end = new Date(base.getFullYear(), base.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return [startOfDay(start), end];
}

export function getYearRange(base: Date, offset: number): [Date, Date] {
  const year = base.getFullYear() + offset;
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return [startOfDay(start), end];
}

export function inRange(iso: string | null | undefined, range: [Date, Date]) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range[0].getTime() && t <= range[1].getTime();
}

export function getDaysInRange(range: [Date, Date]) {
  const ms = range[1].getTime() - range[0].getTime();
  return Math.max(1, Math.ceil(ms / 86400000));
}

export function computeOccupancy(bookingsSubset: Booking[], unitCount: number, range: [Date, Date]): number {
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

export function formatRangeLabel(range: [Date, Date], mode: OverviewMode) {
  if (mode === "year") {
    return range[0].toLocaleDateString("en-PH", { year: "numeric" });
  }
  if (mode === "month") {
    return range[0].toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  }
  const startLabel = range[0].toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  const endLabel = range[1].toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

export interface StatBundle {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  collectedRevenue: number;
  expectedRevenue: number;
  pendingCollection: number;
  collectionPct: number;
  bookingsCount: number;
}

export function computeStats(
  bookingsSubset: Booking[],
  paymentsSubset: Payment[],
  expensesSubset: ExpenseNote[]
): StatBundle {
  const totalIncome = paymentsSubset
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = expensesSubset.reduce((s, n) => s + Number(n.amount), 0);
  const pendingCollection = paymentsSubset
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + Number(p.amount), 0);
  const netIncome = totalIncome - totalExpenses;

  const collectedRevenue = bookingsSubset.reduce((sum, b) => {
    const paid = (b.Payment || [])
      .filter((p) => p.status === "PAID" && (p.type === "DOWNPAYMENT" || p.type === "FULL"))
      .reduce((s, p) => s + Number(p.amount), 0);
    return sum + paid;
  }, 0);

  const expectedRevenue = bookingsSubset
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => sum + Number(b.totalFee || 0), 0);

  const collectionPct =
    expectedRevenue > 0 ? Math.min(100, Math.round((collectedRevenue / expectedRevenue) * 100)) : 0;

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

export interface ChartBucket {
  label: string;
  value: number;
}

export function buildChartBuckets(
  paymentsSubset: Payment[],
  range: [Date, Date],
  mode: OverviewMode
): ChartBucket[] {
  const paid = paymentsSubset.filter((p) => p.status === "PAID" && p.paidAt);

  if (mode === "week") {
    const buckets: ChartBucket[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(range[0]);
      d.setDate(d.getDate() + i);
      const dayStart = startOfDay(d).getTime();
      const dayEnd = endOfDay(d).getTime();
      const value = paid
        .filter((p) => {
          const t = new Date(p.paidAt as string).getTime();
          return t >= dayStart && t <= dayEnd;
        })
        .reduce((s, p) => s + Number(p.amount), 0);
      buckets.push({ label: d.toLocaleDateString("en-PH", { weekday: "short" }), value });
    }
    return buckets;
  }

  if (mode === "month") {
    const days = getDaysInRange(range);
    const buckets: ChartBucket[] = [];
    const step = Math.max(1, Math.ceil(days / 10));
    for (let i = 0; i < days; i += step) {
      const segStart = new Date(range[0]);
      segStart.setDate(segStart.getDate() + i);
      const segEndDate = new Date(range[0]);
      segEndDate.setDate(segEndDate.getDate() + Math.min(i + step - 1, days - 1));
      const segStartMs = startOfDay(segStart).getTime();
      const segEndMs = endOfDay(segEndDate).getTime();
      const value = paid
        .filter((p) => {
          const t = new Date(p.paidAt as string).getTime();
          return t >= segStartMs && t <= segEndMs;
        })
        .reduce((s, p) => s + Number(p.amount), 0);
      buckets.push({ label: `${segStart.getDate()}`, value });
    }
    return buckets;
  }

  const buckets: ChartBucket[] = [];
  const year = range[0].getFullYear();
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1).getTime();
    const monthEnd = new Date(year, m + 1, 0, 23, 59, 59, 999).getTime();
    const value = paid
      .filter((p) => {
        const t = new Date(p.paidAt as string).getTime();
        return t >= monthStart && t <= monthEnd;
      })
      .reduce((s, p) => s + Number(p.amount), 0);
    buckets.push({ label: new Date(year, m, 1).toLocaleDateString("en-PH", { month: "short" }), value });
  }
  return buckets;
}

export type StayCategory = "day" | "night" | "full";

export function getStayCategory(stayType: string | null | undefined): StayCategory {
  const s = (stayType || "").toLowerCase();
  if (s.includes("night")) return "night";
  if (s.includes("long")) return "full";
  return "day";
}

export interface StayMixEntry {
  key: StayCategory;
  label: string;
  hrs: string;
  note: string;
  count: number;
  pct: number;
  colorVar: string;
}

export function buildStayMix(bookingsSubset: Booking[]): StayMixEntry[] {
  const active = bookingsSubset.filter((b) => b.status !== "CANCELLED");
  const total = active.length;
  const counts: Record<StayCategory, number> = { day: 0, night: 0, full: 0 };
  active.forEach((b) => {
    counts[getStayCategory(b.stayType)]++;
  });

  const meta: Record<StayCategory, { label: string; hrs: string; note: string; colorVar: string }> = {
    day: { label: "Day Short", hrs: "8AM–8PM", note: "Daytime use, no overnight", colorVar: "var(--amber)" },
    night: { label: "Night Short", hrs: "9PM–7AM", note: "Overnight, evening to morning", colorVar: "var(--violet)" },
    full: { label: "Day Long", hrs: "2PM–11AM", note: "Full-day check-in to check-out", colorVar: "var(--rausch)" },
  };

  return (["day", "night", "full"] as StayCategory[]).map((key) => ({
    key,
    label: meta[key].label,
    hrs: meta[key].hrs,
    note: meta[key].note,
    count: counts[key],
    pct: total > 0 ? Math.round((counts[key] / total) * 100) : 0,
    colorVar: meta[key].colorVar,
  }));
}
