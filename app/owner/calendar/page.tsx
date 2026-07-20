"use client";

import React from "react";
import { useOwnerData } from "../OwnerDataContext";
import UnitCalendar from "@/components/ui/UnitCalendar";

export default function OwnerCalendarPage() {
  const { properties, bookings } = useOwnerData();
  return <UnitCalendar properties={properties} bookings={bookings} />;
}
