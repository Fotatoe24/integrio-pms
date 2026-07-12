// lib/manila-time.ts
export function nowInManila(): Date {
  const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
  return new Date(s);
}

export function manilaDateString(d: Date = new Date()): string {
  // YYYY-MM-DD in Asia/Manila, safe for date-only columns
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isAfter7AMManila(d: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      hour12: false,
    }).format(d)
  );
  return hour >= 7;
}

export function addDaysManila(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
