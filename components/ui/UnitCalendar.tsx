"use client";

import { useState } from "react";

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

const DAY_LONG_TYPES = ["Day (Long) 2PM-11AM", "Custom"];

function getDayAvailability(bookings: Booking[]) {
  const active = bookings.filter(
    (b) => b.status !== "CANCELLED" && b.status !== "CHECKED_OUT"
  );

  if (active.length === 0) return { state: "AVAILABLE", count: 0 };

  const hasDayLong = active.some((b) =>
    DAY_LONG_TYPES.includes(b.stayType || "")
  );

  if (hasDayLong || active.length >= 2) {
    return { state: "FULLY_BOOKED", count: active.length };
  }

  return { state: "PARTIAL", count: active.length };
}

const STATE_COLORS: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  AVAILABLE: { bg: "#22c55e", border: "#16a34a", text: "white" },
  PARTIAL: { bg: "#f59e0b", border: "#d97706", text: "white" },
  FULLY_BOOKED: { bg: "#ef4444", border: "#dc2626", text: "white" },
  OTHER_MONTH: { bg: "#f0f4f8", border: "#e8edf3", text: "#8896a5" },
};

interface UnitCalendarProps {
  properties: Property[];
  bookings: Booking[];
}

export default function UnitCalendar({
  properties,
  bookings,
}: UnitCalendarProps) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedUnit, setSelectedUnit] = useState<string>("ALL");

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthLabel = calendarDate.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  function getCalendarCells() {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { day: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, isCurrentMonth: true });
    }
    while (cells.length % 7 !== 0) {
      cells.push({
        day: cells.length - daysInMonth - firstDay + 1,
        isCurrentMonth: false,
      });
    }
    return cells;
  }

  function getBookingsForUnitDay(propertyId: string, day: number) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    return bookings.filter((b) => {
      if (b.propertyId !== propertyId) return false;
      const ci = new Date(b.checkIn);
      ci.setHours(0, 0, 0, 0);
      const co = new Date(b.checkOut);
      co.setHours(0, 0, 0, 0);
      return date >= ci && date <= co;
    });
  }

  const cells = getCalendarCells();
  const visibleProperties =
    selectedUnit === "ALL"
      ? properties
      : properties.filter((p) => p.id === selectedUnit);

  const totalBookingsThisMonth = bookings.filter((b) => {
    const ci = new Date(b.checkIn);
    return (
      ci.getFullYear() === year &&
      ci.getMonth() === month &&
      b.status !== "CANCELLED"
    );
  }).length;

  function bookingsThisMonthForUnit(propertyId: string) {
    return bookings.filter((b) => {
      const ci = new Date(b.checkIn);
      return (
        b.propertyId === propertyId &&
        ci.getFullYear() === year &&
        ci.getMonth() === month &&
        b.status !== "CANCELLED"
      );
    }).length;
  }

  return (
    <div>
      {/* Nav + unit selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
            style={{
              background: "white",
              border: "1.5px solid #e8edf3",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 14,
              color: "#1a2744",
              fontWeight: 600,
            }}
          >
            ← Previous
          </button>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#1a2744",
              minWidth: 140,
              textAlign: "center",
            }}
          >
            {monthLabel}
          </span>
          <button
            onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
            style={{
              background: "white",
              border: "1.5px solid #e8edf3",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 14,
              color: "#1a2744",
              fontWeight: 600,
            }}
          >
            Next →
          </button>
          <button
            onClick={() => setCalendarDate(new Date())}
            style={{
              background: "#f0f4f8",
              border: "1.5px solid #e8edf3",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 13,
              color: "#8896a5",
              fontWeight: 600,
            }}
          >
            Today
          </button>
        </div>

        <select
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
          style={{
            padding: "9px 14px",
            border: "1.5px solid #e8edf3",
            borderRadius: 10,
            fontSize: 13,
            color: "#1a2744",
            background: "white",
            outline: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <option value="ALL">All Units</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Total bookings banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
          borderRadius: 16,
          padding: "24px 28px",
          marginBottom: 20,
          color: "white",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            opacity: 0.85,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 6,
          }}
        >
          Total bookings this month
        </div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>
          {totalBookingsThisMonth}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        {[
          { label: "Available", color: STATE_COLORS.AVAILABLE.bg },
          { label: "Partially Available", color: STATE_COLORS.PARTIAL.bg },
          { label: "Fully Booked", color: STATE_COLORS.FULLY_BOOKED.bg },
          { label: "Other Month", color: STATE_COLORS.OTHER_MONTH.bg },
        ].map((item) => (
          <div
            key={item.label}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: item.color,
              }}
            />
            <span style={{ fontSize: 13, color: "#1a2744", fontWeight: 500 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Unit grids */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            visibleProperties.length === 1
              ? "1fr"
              : "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
        }}
      >
        {visibleProperties.map((property) => (
          <div
            key={property.id}
            style={{
              background: "white",
              borderRadius: 16,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}
          >
            {/* Unit header */}
            <div
              style={{
                background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
                padding: "16px 20px",
                color: "white",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {property.name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                {bookingsThisMonthForUnit(property.id)} bookings this month
              </div>
            </div>

            {/* Day headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                borderBottom: "1px solid #e8edf3",
              }}
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  style={{
                    padding: "8px 0",
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#8896a5",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                padding: 8,
                gap: 4,
              }}
            >
              {cells.map((cell, i) => {
                if (!cell.isCurrentMonth) {
                  return (
                    <div
                      key={i}
                      style={{
                        aspectRatio: "1",
                        background: STATE_COLORS.OTHER_MONTH.bg,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: STATE_COLORS.OTHER_MONTH.text,
                      }}
                    >
                      {cell.day}
                    </div>
                  );
                }

                const dayBookings = getBookingsForUnitDay(
                  property.id,
                  cell.day
                );
                const { state, count } = getDayAvailability(dayBookings);
                const colors = STATE_COLORS[state];
                const firstBooking = dayBookings.find(
                  (b) => b.status !== "CANCELLED" && b.status !== "CHECKED_OUT"
                );

                return (
                  <div
                    key={i}
                    title={dayBookings
                      .map(
                        (b) =>
                          `${b.guestName} (${b.checkInTime || ""}-${
                            b.checkOutTime || ""
                          })`
                      )
                      .join("\n")}
                    style={{
                      position: "relative",
                      aspectRatio: "1",
                      background: colors.bg,
                      border: `1.5px solid ${colors.border}`,
                      borderRadius: 8,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 4,
                      cursor: count > 0 ? "pointer" : "default",
                    }}
                  >
                    {count > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          background: "rgba(0,0,0,0.25)",
                          color: "white",
                          borderRadius: "50%",
                          width: 16,
                          height: 16,
                          fontSize: 10,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {count}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.text,
                      }}
                    >
                      {cell.day}
                    </div>
                    {firstBooking?.checkInTime && (
                      <div
                        style={{
                          fontSize: 8,
                          color: colors.text,
                          opacity: 0.9,
                          marginTop: 1,
                          textAlign: "center",
                        }}
                      >
                        {firstBooking.checkInTime}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {visibleProperties.length === 0 && (
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <h3 style={{ color: "#1a2744", marginBottom: 8 }}>
            No properties found
          </h3>
          <p style={{ color: "#8896a5", fontSize: 14 }}>
            Add a property to see its availability calendar.
          </p>
        </div>
      )}
    </div>
  );
}
