"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import UnitCalendar from "@/components/ui/UnitCalendar";

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

export default function CalendarPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Calendar";
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: propertiesData }, { data: bookingsData }] =
      await Promise.all([
        supabase.from("Property").select("id, name"),
        supabase
          .from("Booking")
          .select(
            "id, propertyId, guestName, checkIn, checkOut, checkInTime, checkOutTime, stayType, status"
          ),
      ]);
    if (propertiesData) setProperties(propertiesData);
    if (bookingsData) setBookings(bookingsData);
    setLoading(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1a2744",
            marginBottom: 4,
          }}
        >
          Unit Availability Calendar
        </h1>
        <p style={{ color: "#8896a5", fontSize: 14 }}>
          View booking density across all units
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
          Loading...
        </div>
      ) : (
        <UnitCalendar properties={properties} bookings={bookings} />
      )}
    </div>
  );
}
