"use client";

import { useMemo, useState, type CSSProperties } from "react";

/* ────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────── */

interface Property {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  stayType: string | null;
  status: string;
}

interface UnitCalendarProps {
  properties: Property[];
  bookings: Booking[];
}

/* ────────────────────────────────────────────────────────────────
   Stay-type → lane / colour config
   (mirrors the Day / Night / Day-Long / Custom categories already
   used elsewhere in the app)
   ──────────────────────────────────────────────────────────────── */

const DAY_LONG_TYPES = ["Day (Long) 2PM-11AM", "Custom"];

type Category = "Day" | "Night" | "Day Long" | "Other";
type Slot = "day" | "night" | "full";

function getCategory(stayType: string | null): Category {
  if (!stayType) return "Other";
  if (DAY_LONG_TYPES.includes(stayType)) return "Day Long";
  if (stayType.startsWith("Night")) return "Night";
  if (stayType.startsWith("Day")) return "Day";
  return "Other";
}

const TYPE_CONFIG: Record<
  Category,
  { slot: Slot; label: string; short: string; color: string; bg: string }
> = {
  Day: {
    slot: "day",
    label: "Daycation",
    short: "DAY",
    color: "var(--ec-day)",
    bg: "var(--ec-day-bg)",
  },
  Night: {
    slot: "night",
    label: "Night stay",
    short: "NIGHT",
    color: "var(--ec-night)",
    bg: "var(--ec-night-bg)",
  },
  "Day Long": {
    slot: "full",
    label: "Full / long stay",
    short: "FULL",
    color: "var(--ec-full)",
    bg: "var(--ec-full-bg)",
  },
  Other: {
    slot: "full",
    label: "Other",
    short: "OTHER",
    color: "var(--ec-other)",
    bg: "var(--ec-other-bg)",
  },
};

/* ────────────────────────────────────────────────────────────────
   Date helpers
   ──────────────────────────────────────────────────────────────── */

const DAY_MS = 86400000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDay(d: Date) {
  return startOfDay(d).getTime();
}

interface BookingBounds {
  booking: Booking;
  category: Category;
  slot: Slot;
  start: number;
  end: number;
}

// Postgres timestamptz columns often come through as "2026-07-18 13:00:00+00"
// (space separator, no colon in the offset) which some browsers' Date parser
// rejects or mis-parses. Normalize to a strict ISO string before parsing.
function parseTimestamp(raw: string): number {
  let s = raw.trim();
  if (s.includes(" ") && !s.includes("T")) s = s.replace(" ", "T");
  s = s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"); // +0800 -> +08:00
  s = s.replace(/([+-]\d{2})$/, "$1:00"); // +00 -> +00:00
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? new Date(raw).getTime() : t;
}

function computeBounds(b: Booking): BookingBounds {
  const category = getCategory(b.stayType);
  const conf = TYPE_CONFIG[category];
  // checkIn/checkOut are the real, precise instants for this stay — use them
  // directly rather than re-deriving hours from the stay-type category
  // (that previously produced wrong times whenever the actual booking didn't
  // match the category's "typical" hours, e.g. a "Night (Short) 9PM-7AM" stay).
  const start = parseTimestamp(b.checkIn);
  let end = parseTimestamp(b.checkOut);
  if (!(end > start)) end = start + 3600000; // guard against bad/equal data
  return { booking: b, category, slot: conf.slot, start, end };
}

function fmtShort(ts: number) {
  return new Date(ts).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────── */

const DAY_H = 40;
const NIGHT_H = 40;
const FULL_H = DAY_H + NIGHT_H + 1;
const NAME_W = 210;
const SLOT_LABEL_W = 52;

export default function UnitCalendar({
  properties,
  bookings,
}: UnitCalendarProps) {
  const [anchor, setAnchor] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");

  const colW = view === "week" ? 120 : 48;

  const days = useMemo(() => {
    const out: { d: Date; ts: number; weekend: boolean; today: boolean }[] = [];
    if (view === "month") {
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      for (let d = 1; d <= last.getDate(); d++) {
        const dt = new Date(anchor.getFullYear(), anchor.getMonth(), d);
        out.push(dayInfo(dt));
      }
    } else {
      const start = addDays(anchor, -anchor.getDay());
      for (let i = 0; i < 7; i++) out.push(dayInfo(addDays(start, i)));
    }
    return out;

    function dayInfo(dt: Date) {
      const w = dt.getDay();
      return {
        d: dt,
        ts: isoDay(dt),
        weekend: w === 0 || w === 6,
        today: isoDay(dt) === isoDay(new Date()),
      };
    }
  }, [anchor, view]);

  const periodLabel =
    view === "month"
      ? anchor.toLocaleDateString("en-PH", { month: "long", year: "numeric" })
      : (() => {
          const a = days[0].d;
          const b = days[6].d;
          const sameMonth = a.getMonth() === b.getMonth();
          return `${a.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
          })} – ${b.toLocaleDateString(
            "en-PH",
            sameMonth
              ? { day: "numeric", year: "numeric" }
              : { month: "short", day: "numeric", year: "numeric" }
          )}`;
        })();

  const firstTs = days[0]?.ts ?? 0;
  const lastTs = (days[days.length - 1]?.ts ?? 0) + DAY_MS;
  const totalW = days.length * colW;

  // All active (non-cancelled) bookings with computed bounds
  const allActive = useMemo(
    () => bookings.filter((b) => b.status !== "CANCELLED").map(computeBounds),
    [bookings]
  );

  const nowTs = Date.now();
  const todayStartTs = isoDay(new Date());

  const occupiedPropertyIds = useMemo(() => {
    const set = new Set<string>();
    allActive.forEach((o) => {
      if (o.start <= nowTs && nowTs < o.end) set.add(o.booking.propertyId);
    });
    return set;
  }, [allActive, nowTs]);

  const checkInsToday = allActive.filter(
    (o) => isoDay(new Date(o.start)) === todayStartTs
  ).length;

  const upcomingCheckIns = useMemo(
    () =>
      allActive
        .filter((o) => o.start >= nowTs)
        .sort((a, b) => a.start - b.start)
        .slice(0, 6),
    [allActive, nowTs]
  );

  const upcomingCheckOuts = useMemo(
    () =>
      allActive
        .filter((o) => o.end >= nowTs)
        .sort((a, b) => a.end - b.end)
        .slice(0, 6),
    [allActive, nowTs]
  );

  function propertyLabel(propertyId: string) {
    return properties.find((p) => p.id === propertyId)?.name || "—";
  }

  function shift(n: number) {
    setAnchor(
      view === "month"
        ? new Date(anchor.getFullYear(), anchor.getMonth() + n, 1)
        : addDays(anchor, n * 7)
    );
  }

  return (
    <div className="evcal">
      {/* Header */}
      <div className="evcal-head">
        <div>
          <h1>Availability Calendar</h1>
          <div className="evcal-sub">
            {properties.length} unit{properties.length !== 1 ? "s" : ""} · hover
            a booking to see details
          </div>
        </div>
        <div className="evcal-toolbar">
          <div className="evcal-seg">
            <button
              className={view === "month" ? "on" : ""}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              className={view === "week" ? "on" : ""}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>
          <div className="evcal-pnav">
            <button
              className="evcal-navb"
              onClick={() => shift(-1)}
              aria-label="Previous"
            >
              ‹
            </button>
            <span className="evcal-lbl">{periodLabel}</span>
            <button
              className="evcal-navb"
              onClick={() => shift(1)}
              aria-label="Next"
            >
              ›
            </button>
          </div>
          <button className="evcal-btn" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <a href="/dashboard/bookings" className="evcal-btn primary">
            + New Booking
          </a>
        </div>
      </div>

      {/* Legend */}
      <div className="evcal-legend">
        <span className="evcal-legend-head">Stay types</span>
        {(["Day Long", "Day", "Night", "Other"] as Category[]).map((c) => (
          <span key={c} className="evcal-lg">
            <span
              className="evcal-dot"
              style={{ background: TYPE_CONFIG[c].color }}
            />
            {TYPE_CONFIG[c].label}
          </span>
        ))}
        <span className="evcal-legend-note">
          Daycation &amp; Night stay can share one date — each shown in its own
          lane
        </span>
      </div>

      <div className="evcal-layout">
        {/* ── Timeline ── */}
        <div className="evcal-cal-wrap">
          <div className="evcal-cal-scroll">
            <div
              className="evcal-cal-inner"
              style={{ minWidth: NAME_W + SLOT_LABEL_W + totalW }}
            >
              {/* Column header */}
              <div className="evcal-cal-head">
                <div
                  className="evcal-corner"
                  style={{ width: NAME_W + SLOT_LABEL_W }}
                >
                  Unit
                </div>
                <div className="evcal-dhead">
                  {days.map((x, i) => (
                    <div
                      key={i}
                      className={`evcal-dcol${x.weekend ? " weekend" : ""}${
                        x.today ? " today" : ""
                      }`}
                      style={{ width: colW }}
                    >
                      <div className="dow">
                        {x.d.toLocaleDateString("en-PH", { weekday: "short" })}
                      </div>
                      <div className="dnum">{x.d.getDate()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unit rows */}
              {properties.map((property) => {
                const mine = allActive
                  .filter(
                    (o) =>
                      o.booking.propertyId === property.id &&
                      o.end > firstTs &&
                      o.start < lastTs
                  )
                  .sort((a, b) => a.start - b.start);

                const dayItems = mine.filter((o) => o.slot === "day");
                const nightItems = mine.filter((o) => o.slot === "night");
                const fullItems = mine.filter((o) => o.slot === "full");

                const dayDates = new Set(
                  dayItems.map((o) => isoDay(new Date(o.start)))
                );
                const nightDates = new Set(
                  nightItems.map((o) => isoDay(new Date(o.start)))
                );

                function pillStyle(
                  o: BookingBounds,
                  top: number,
                  height: number
                ): CSSProperties {
                  const rawLeft = ((o.start - firstTs) / DAY_MS) * colW;
                  const rawRight = ((o.end - firstTs) / DAY_MS) * colW;
                  const left = Math.max(0, rawLeft);
                  const right = Math.min(totalW, rawRight);
                  const width = Math.max(20, right - left);
                  const conf = TYPE_CONFIG[o.category];
                  return {
                    position: "absolute",
                    left,
                    width,
                    top: top + 3,
                    height: height - 6,
                    background: conf.color,
                  };
                }

                function renderPill(
                  o: BookingBounds,
                  top: number,
                  height: number
                ) {
                  const conf = TYPE_CONFIG[o.category];
                  const dimmed = o.booking.status === "CHECKED_OUT";
                  const tip = `${o.booking.guestName}\n${
                    o.booking.stayType || conf.label
                  }\n${fmtShort(o.start)} ${fmtTime(o.start)} → ${fmtShort(
                    o.end
                  )} ${fmtTime(o.end)}`;
                  const style = pillStyle(o, top, height);
                  const width =
                    typeof style.width === "number" ? style.width : 0;
                  const showTag = width >= 46;
                  const showName = width >= 30;
                  return (
                    <div
                      key={o.booking.id}
                      className="evcal-res"
                      style={{ ...style, opacity: dimmed ? 0.55 : 1 }}
                      title={tip}
                    >
                      {showName && (
                        <span className="nm">{o.booking.guestName}</span>
                      )}
                      {showTag && <span className="tag">{conf.short}</span>}
                    </div>
                  );
                }

                return (
                  <div className="evcal-urow" key={property.id}>
                    <div
                      className="evcal-urow-left"
                      style={{ width: NAME_W + SLOT_LABEL_W }}
                    >
                      <div className="evcal-uname" style={{ width: NAME_W }}>
                        <div className="n">{property.name}</div>
                        <div className="loc">
                          {mine.length} booking{mine.length !== 1 ? "s" : ""}{" "}
                          shown
                        </div>
                      </div>
                      <div
                        className="evcal-slot-labels"
                        style={{ width: SLOT_LABEL_W, minHeight: FULL_H }}
                      >
                        <div
                          className="evcal-slot-lbl day-lbl"
                          style={{ height: DAY_H }}
                        >
                          ☀
                        </div>
                        <div
                          className="evcal-slot-lbl night-lbl"
                          style={{ height: NIGHT_H }}
                        >
                          🌙
                        </div>
                      </div>
                    </div>

                    <div className="evcal-utrack">
                      <div style={{ position: "relative", width: totalW }}>
                        {/* background cells */}
                        <div
                          style={{ display: "flex", flexDirection: "column" }}
                        >
                          <div
                            className="evcal-day-row day-slot"
                            style={{ height: DAY_H }}
                          >
                            {days.map((x, i) => (
                              <div
                                key={i}
                                className={`evcal-dcell${
                                  x.weekend ? " weekend" : ""
                                }${x.today ? " today" : ""}`}
                                style={{ width: colW }}
                              />
                            ))}
                          </div>
                          <div
                            className="evcal-day-row"
                            style={{ height: NIGHT_H }}
                          >
                            {days.map((x, i) => (
                              <div
                                key={i}
                                className={`evcal-dcell${
                                  x.weekend ? " weekend" : ""
                                }${x.today ? " today" : ""}`}
                                style={{ width: colW }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* split-day badges */}
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                          }}
                        >
                          {days.map((x, i) => {
                            const key = x.ts;
                            if (!dayDates.has(key) || !nightDates.has(key))
                              return null;
                            return (
                              <div
                                key={i}
                                className="evcal-split-badge"
                                style={{ left: i * colW, width: colW }}
                              >
                                <span>DAY+NIGHT</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* pills */}
                        {fullItems.map((o) => renderPill(o, 0, FULL_H))}
                        {dayItems.map((o) => renderPill(o, 0, DAY_H))}
                        {nightItems.map((o) =>
                          renderPill(o, DAY_H + 1, NIGHT_H)
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {properties.length === 0 && (
                <div className="evcal-empty-state">
                  No properties yet — add one to see its availability here.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="evcal-side">
          <div className="evcal-card">
            <h3>Today at a glance</h3>
            <div className="evcal-sum-grid">
              <div className="evcal-sum accent">
                <div className="n">{checkInsToday}</div>
                <div className="l">Check-ins today</div>
              </div>
              <div className="evcal-sum">
                <div className="n">{occupiedPropertyIds.size}</div>
                <div className="l">Occupied now</div>
              </div>
              <div className="evcal-sum">
                <div className="n">
                  {properties.length - occupiedPropertyIds.size}
                </div>
                <div className="l">Available</div>
              </div>
            </div>
          </div>

          <div className="evcal-card">
            <h3>Upcoming check-ins</h3>
            {upcomingCheckIns.length === 0 ? (
              <div className="evcal-empty">No upcoming check-ins.</div>
            ) : (
              upcomingCheckIns.map((o) => (
                <div className="evcal-up" key={o.booking.id}>
                  <div className="evcal-up-d">
                    {fmtShort(o.start)}
                    <div className="t">{fmtTime(o.start)}</div>
                  </div>
                  <div className="info">
                    <div className="g">{o.booking.guestName}</div>
                    <div className="u">
                      {propertyLabel(o.booking.propertyId)} ·{" "}
                      {o.booking.stayType || TYPE_CONFIG[o.category].label}
                    </div>
                  </div>
                  <span
                    className="evcal-tdot"
                    style={{ background: TYPE_CONFIG[o.category].color }}
                  />
                </div>
              ))
            )}
          </div>

          <div className="evcal-card">
            <h3>Upcoming check-outs</h3>
            {upcomingCheckOuts.length === 0 ? (
              <div className="evcal-empty">No upcoming check-outs.</div>
            ) : (
              upcomingCheckOuts.map((o) => (
                <div className="evcal-up" key={o.booking.id}>
                  <div className="evcal-up-d">
                    {fmtShort(o.end)}
                    <div className="t">{fmtTime(o.end)}</div>
                  </div>
                  <div className="info">
                    <div className="g">{o.booking.guestName}</div>
                    <div className="u">
                      {propertyLabel(o.booking.propertyId)} ·{" "}
                      {o.booking.stayType || TYPE_CONFIG[o.category].label}
                    </div>
                  </div>
                  <span
                    className="evcal-tdot"
                    style={{ background: TYPE_CONFIG[o.category].color }}
                  />
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .evcal {
          --ec-rose: #E8325A;
          --ec-blue: #3B71E8;
          --ec-violet: #7C5CE7;
          --ec-green: #0D9E6E;
          --ec-ink: #1A1A22;
          --ec-gray: #6E7280;
          --ec-gray2: #A0A4B0;
          --ec-line: #EAECF0;
          --ec-line2: #D8DCE4;
          --ec-bg: #F6F7FB;
          --ec-bg2: #ECEEF4;
          --ec-card: #FFFFFF;
          --ec-weekend: #F2F3F8;
          --ec-today-tint: rgba(232,50,90,.06);
          --ec-shadow: 0 4px 20px rgba(0,0,0,.08);
          --ec-shadow-s: 0 2px 8px rgba(0,0,0,.05);
          --ec-day: #0D9E6E; --ec-day-bg: rgba(13,158,110,.12);
          --ec-night: #7C5CE7; --ec-night-bg: rgba(124,92,231,.12);
          --ec-full: #3B71E8; --ec-full-bg: rgba(59,113,232,.12);
          --ec-other: #8E99AA; --ec-other-bg: rgba(142,153,170,.12);
          font-family: 'Manrope', -apple-system, sans-serif;
          color: var(--ec-ink);
        }

        .evcal-head { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:14px; margin-bottom:16px; }
        .evcal-head h1 { font-size:22px; font-weight:800; letter-spacing:-.02em; margin:0; }
        .evcal-sub { color: var(--ec-gray); font-size:13px; margin-top:3px; }
        .evcal-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .evcal-seg { display:inline-flex; background: var(--ec-card); border:1px solid var(--ec-line2); border-radius:999px; padding:3px; }
        .evcal-seg button { border:0; background:transparent; color:var(--ec-gray); font-weight:700; font-size:12.5px; padding:6px 14px; border-radius:999px; cursor:pointer; transition:.15s; }
        .evcal-seg button.on { background: var(--ec-rose); color:#fff; }
        .evcal-pnav { display:inline-flex; align-items:center; gap:5px; }
        .evcal-lbl { font-weight:800; font-size:14px; min-width:150px; text-align:center; }
        .evcal-navb { width:32px; height:32px; border:1px solid var(--ec-line2); border-radius:9px; background:var(--ec-card); color:var(--ec-ink); cursor:pointer; font-size:16px; line-height:1; }
        .evcal-navb:hover { border-color: var(--ec-gray); }
        .evcal-btn { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--ec-line2); background:var(--ec-card); color:var(--ec-ink); font-weight:700; font-size:13px; padding:8px 14px; border-radius:10px; cursor:pointer; text-decoration:none; }
        .evcal-btn:hover { border-color: var(--ec-gray); box-shadow: var(--ec-shadow-s); }
        .evcal-btn.primary { background: var(--ec-rose); border-color: var(--ec-rose); color:#fff; }

        .evcal-legend { display:flex; flex-wrap:wrap; align-items:center; gap:6px 18px; padding:11px 16px; background:var(--ec-card); border:1px solid var(--ec-line); border-radius:12px; margin-bottom:16px; }
        .evcal-legend-head { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--ec-gray2); }
        .evcal-lg { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--ec-gray); }
        .evcal-dot { width:10px; height:10px; border-radius:50%; }
        .evcal-legend-note { font-size:11.5px; font-weight:600; color:var(--ec-gray); background:var(--ec-bg2); border-radius:8px; padding:4px 10px; }

        .evcal-layout { display:grid; grid-template-columns: 1fr 300px; gap:18px; align-items:start; }
        @media (max-width: 1100px) { .evcal-layout { grid-template-columns: 1fr; } }

        .evcal-cal-wrap { border:1px solid var(--ec-line); border-radius:14px; background:var(--ec-card); box-shadow: var(--ec-shadow); overflow:hidden; }
        .evcal-cal-scroll { overflow-x:auto; }

        .evcal-cal-head { display:flex; border-bottom:2px solid var(--ec-line); position:sticky; top:0; z-index:12; background:var(--ec-card); }
        .evcal-corner { flex:none; position:sticky; left:0; z-index:13; background:var(--ec-card); border-right:1px solid var(--ec-line); display:flex; align-items:center; padding:0 16px; font-size:10.5px; font-weight:800; color:var(--ec-gray2); text-transform:uppercase; letter-spacing:.06em; }
        .evcal-dhead { display:flex; }
        .evcal-dcol { flex:none; text-align:center; padding:8px 2px; border-left:1px solid var(--ec-line); }
        .evcal-dcol.weekend { background: var(--ec-weekend); }
        .evcal-dcol.today { background: var(--ec-today-tint); border-left:2px solid var(--ec-rose); }
        .evcal-dcol .dow { font-size:9.5px; font-weight:700; color:var(--ec-gray2); text-transform:uppercase; }
        .evcal-dcol .dnum { font-size:14px; font-weight:800; margin-top:2px; }
        .evcal-dcol.today .dnum { color: var(--ec-rose); }

        .evcal-urow { display:flex; border-bottom:1px solid var(--ec-line); }
        .evcal-urow:last-child { border-bottom:0; }
        .evcal-urow-left { display:flex; flex:none; position:sticky; left:0; z-index:5; background:var(--ec-card); border-right:1px solid var(--ec-line); }
        .evcal-uname { flex:none; display:flex; flex-direction:column; justify-content:center; padding:10px 14px; gap:2px; border-right:1px solid var(--ec-line); }
        .evcal-uname .n { font-size:13px; font-weight:800; letter-spacing:-.01em; line-height:1.3; }
        .evcal-uname .loc { font-size:10.5px; color:var(--ec-gray2); font-weight:600; }
        .evcal-slot-labels { flex:none; display:flex; flex-direction:column; background: var(--ec-bg); }
        .evcal-slot-lbl { flex:none; display:flex; align-items:center; justify-content:center; font-size:12px; }
        .evcal-slot-lbl.day-lbl { background: var(--ec-day-bg); border-bottom:1px solid var(--ec-line); }
        .evcal-slot-lbl.night-lbl { background: var(--ec-night-bg); }

        .evcal-utrack { position:relative; flex:1; overflow:hidden; }
        .evcal-day-row { display:flex; }
        .evcal-day-row.day-slot { border-bottom:2px solid var(--ec-line); background: rgba(13,158,110,.02); }
        .evcal-dcell { flex:none; border-left:1px solid var(--ec-line); }
        .evcal-dcell.weekend { background: var(--ec-weekend); }
        .evcal-dcell.today { background: var(--ec-today-tint); border-left:2px solid rgba(232,50,90,.25); }

        .evcal-res { border-radius:7px; display:flex; align-items:center; gap:5px; padding:0 8px; font-size:11px; font-weight:700; overflow:hidden; cursor:default; white-space:nowrap; z-index:4; color:#fff; transition: filter .12s, transform .1s; }
        .evcal-res:hover { filter:brightness(1.06); transform: translateY(-1px); z-index:6; box-shadow: 0 4px 14px rgba(0,0,0,.2); }
        .evcal-res .nm { overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0; }
        .evcal-res .tag { background: rgba(255,255,255,.22); border-radius:4px; padding:1px 5px; font-size:9px; font-weight:800; flex:none; }

        .evcal-split-badge { position:absolute; top:1px; display:flex; justify-content:center; pointer-events:none; z-index:5; }
        .evcal-split-badge span { font-size:8px; font-weight:800; background:var(--ec-rose); color:#fff; padding:1px 4px; border-radius:4px; }

        .evcal-empty-state { padding:48px 20px; text-align:center; color:var(--ec-gray); font-size:13px; }

        .evcal-side { display:flex; flex-direction:column; gap:14px; position:sticky; top:12px; }
        .evcal-card { border:1px solid var(--ec-line); border-radius:14px; background:var(--ec-card); box-shadow: var(--ec-shadow-s); padding:16px; }
        .evcal-card h3 { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--ec-gray2); margin:0 0 12px; }
        .evcal-sum-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .evcal-sum { border:1px solid var(--ec-line); border-radius:10px; padding:11px 13px; }
        .evcal-sum .n { font-size:22px; font-weight:800; letter-spacing:-.02em; }
        .evcal-sum .l { font-size:11px; color:var(--ec-gray); font-weight:600; margin-top:2px; }
        .evcal-sum.accent { grid-column: 1 / -1; background: rgba(232,50,90,.06); border-color: rgba(232,50,90,.2); }
        .evcal-sum.accent .n { color: var(--ec-rose); }
        .evcal-up { display:flex; align-items:flex-start; gap:10px; padding:9px 0; border-top:1px solid var(--ec-line); }
        .evcal-up:first-of-type { border-top:0; }
        .evcal-up-d { font-size:11px; font-weight:800; min-width:46px; line-height:1.35; }
        .evcal-up-d .t { color:var(--ec-gray); font-weight:600; font-size:10.5px; margin-top:1px; }
        .evcal-up .info { flex:1; min-width:0; }
        .evcal-up .g { font-size:12.5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .evcal-up .u { font-size:10.5px; color:var(--ec-gray); margin-top:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .evcal-tdot { width:8px; height:8px; border-radius:50%; flex:none; margin-top:4px; }
        .evcal-empty { color:var(--ec-gray); font-size:12px; padding:6px 0; }

        @media (max-width: 680px) {
          .evcal-lbl { min-width: 110px; font-size: 13px; }
        }
      `}</style>
    </div>
  );
}
