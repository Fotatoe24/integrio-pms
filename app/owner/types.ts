export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  invited_at: string | null;
}

export interface ExpenseNote {
  id: string;
  content: string;
  category: string;
  amount: number;
  createdAt: string;
  created_by: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  type: string;
  amount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  Booking?: { guestName: string; Property?: { name: string } };
}

export interface Receiver {
  id: string;
  name: string;
  owner_id: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  contactNo: string | null;
  platform: string | null;
  checkIn: string;
  checkOut: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  stayType: string | null;
  totalFee: number | null;
  status: string;
  source: string;
  bookedBy?: string | null;
  Property?: { name: string };
  Payment?: Payment[];
}

export interface Property {
  id: string;
  name: string;
}

export interface RedFlag {
  type: "PUNCTUALITY" | "DIRTY_UNIT" | "UNPAID_BALANCE";
  severity: "warn" | "danger";
  message: string;
}

export interface ChecklistItemRow {
  id: string;
  label: string;
  sort_order: number;
}

export interface ChecklistRow {
  id: string;
  title: string;
  is_active: boolean;
  createdAt: string;
  ChecklistItem: ChecklistItemRow[];
}

export const ROLES = ["booker", "auditor", "housekeeping"];
export const COMMISSION_PER_BOOKING = 100;
export const BOOKINGS_PER_PAGE = 8;
export const PAYMENTS_PER_PAGE = 8;
