"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRole, IntegrioUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { Employee, ExpenseNote, Payment, Receiver, Booking, Property, RedFlag } from "./types";

interface OwnerDataContextValue {
  user: IntegrioUser | null;
  loading: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  logout: () => void;

  employees: Employee[];
  expenseNotes: ExpenseNote[];
  payments: Payment[];
  bookings: Booking[];
  properties: Property[];
  receivers: Receiver[];

  flags: RedFlag[];
  flagsLoading: boolean;
  reloadFlags: () => Promise<void>;

  reloadAll: () => Promise<void>;

  addReceiver: (name: string) => Promise<boolean>;
  removeReceiver: (id: string) => Promise<void>;

  inviteEmployee: (input: {
    name: string;
    email: string;
    role: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  revokeEmployee: (emp: Employee) => Promise<void>;
  reactivateEmployee: (emp: Employee) => Promise<void>;
  removeEmployee: (emp: Employee) => Promise<void>;
}

const OwnerDataContext = createContext<OwnerDataContextValue | null>(null);

export function useOwnerData() {
  const ctx = useContext(OwnerDataContext);
  if (!ctx) throw new Error("useOwnerData must be used within <OwnerDataProvider>");
  return ctx;
}

export function OwnerDataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<IntegrioUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenseNotes, setExpenseNotes] = useState<ExpenseNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [receivers, setReceivers] = useState<Receiver[]>([]);

  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);

  const loadAll = useCallback(async (u: IntegrioUser) => {
    setLoading(true);
    const ownerId = u.id;

    const { data: props } = await supabase.from("Property").select("id, name").eq("owner_id", ownerId);
    const propertyIds = (props ?? []).map((p) => p.id);
    setProperties(props ?? []);

    const { data: book } =
      propertyIds.length > 0
        ? await supabase
            .from("Booking")
            .select("*, Property(name), Payment(id, type, amount, status, paidAt)")
            .in("propertyId", propertyIds)
            .order("checkIn", { ascending: false })
        : { data: [] };

    const bookingIds = (book ?? []).map((b) => b.id);
    const { data: pay } =
      bookingIds.length > 0
        ? await supabase
            .from("Payment")
            .select("*, Booking(guestName, Property(name))")
            .in("bookingId", bookingIds)
            .order("createdAt", { ascending: false })
        : { data: [] };

    const [{ data: emp }, { data: exp }] = await Promise.all([
      supabase
        .from("User")
        .select("id, name, email, role, status, createdAt, invited_at, temp_password")
        .eq("owner_id", ownerId)
        .order("createdAt", { ascending: false }),
      supabase.from("ExpenseNote").select("*").eq("owner_id", ownerId).order("createdAt", { ascending: false }),
    ]);

    const { data: rec } = await supabase
      .from("Receiver")
      .select("*")
      .eq("owner_id", ownerId)
      .order("createdAt", { ascending: true });

    if (rec) setReceivers(rec);
    if (emp) setEmployees(emp);
    if (exp) setExpenseNotes(exp);
    if (pay) setPayments(pay);
    if (book) setBookings(book);
    setLoading(false);
  }, []);

  const loadFlags = useCallback(async (u: IntegrioUser) => {
    setFlagsLoading(true);
    try {
      const res = await fetch(`/api/owner/redflags?owner_id=${u.id}`);
      const json = await res.json();
      setFlags(json.flags || []);
    } catch {
      setFlags([]);
    }
    setFlagsLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Owner — Integrio";
    const stored = (typeof window !== "undefined" &&
      localStorage.getItem("integrio_theme")) as "light" | "dark" | null;
    const initialTheme = stored || "light";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);

    const u = requireRole(["owner", "ADMIN"], router);
    if (u) {
      setUser(u);
      loadAll(u);
      loadFlags(u);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("integrio_theme", next);
  }

  function logout() {
    localStorage.removeItem("integrio_user");
    document.cookie = "auth-token=; max-age=0; path=/";
    window.location.href = "/login";
  }

  async function addReceiver(name: string) {
    if (!name.trim() || !user) return false;
    const { data, error } = await supabase
      .from("Receiver")
      .insert({ owner_id: user.id, name: name.trim() })
      .select()
      .single();
    if (!error && data) {
      setReceivers((prev) => [...prev, data]);
      return true;
    }
    return false;
  }

  async function removeReceiver(id: string) {
    const { error } = await supabase.from("Receiver").delete().eq("id", id);
    if (!error) setReceivers((prev) => prev.filter((r) => r.id !== id));
  }

  async function inviteEmployee(input: { name: string; email: string; role: string }) {
    if (!user) return { ok: false, error: "Not signed in." };
    try {
      const res = await fetch("/api/invite-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          role: input.role,
          ownerId: user.id,
          ownerName: user.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) return { ok: false, error: json.error || "Failed to send invite." };
      await loadAll(user);
      return { ok: true };
    } catch {
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  }

  async function revokeEmployee(emp: Employee) {
    const { error } = await supabase.from("User").update({ status: "revoked" }).eq("id", emp.id);
    if (!error) setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, status: "revoked" } : e)));
  }

  async function reactivateEmployee(emp: Employee) {
    const { error } = await supabase.from("User").update({ status: "active" }).eq("id", emp.id);
    if (!error) setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, status: "active" } : e)));
  }

  async function removeEmployee(emp: Employee) {
    const { error } = await supabase.from("User").delete().eq("id", emp.id);
    if (!error) setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
  }

  const value: OwnerDataContextValue = {
    user,
    loading,
    theme,
    toggleTheme,
    logout,
    employees,
    expenseNotes,
    payments,
    bookings,
    properties,
    receivers,
    flags,
    flagsLoading,
    reloadFlags: async () => {
      if (user) await loadFlags(user);
    },
    reloadAll: async () => {
      if (user) await loadAll(user);
    },
    addReceiver,
    removeReceiver,
    inviteEmployee,
    revokeEmployee,
    reactivateEmployee,
    removeEmployee,
  };

  return <OwnerDataContext.Provider value={value}>{children}</OwnerDataContext.Provider>;
}
