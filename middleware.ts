import { NextRequest, NextResponse } from "next/server";
import { verifyToken, ROUTE_ROLES } from "@/lib/auth";

const publicRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/test",
  "/verify",
  "/api/ical",
  "/api/invite-employee",
  "/api/forgot-password",
  "/api/reset-password",
  "/api/cron",
  "/api/sync-ical",
  "/api/bot/availability",
  "/api/bot/parse-availability",
  "/api/bot/create-booking",
  "/api/bot/check-booking-status",
  "/api/housekeeping/login-log",
  "/api/housekeeping/schedule",
  "/api/housekeeping/checklist",
  "/api/owner/redflags",
  "/api/owner/checklist",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublic) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = req.cookies.get("auth-token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("auth-token");
    return res;
  }

  // Force a password reset before any other page becomes reachable.
  if (payload.mustChangePassword && pathname !== "/dashboard/change-password") {
    return NextResponse.redirect(
      new URL("/dashboard/change-password", req.url)
    );
  }
  if (
    !payload.mustChangePassword &&
    pathname === "/dashboard/change-password"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Role-gated routes (API routes are matched here too, e.g. /api/admin/*
  // — add entries to ROUTE_ROLES in lib/auth.ts as new sections are built).
  const matched = Object.keys(ROUTE_ROLES).find((base) =>
    pathname.startsWith(base)
  );
  if (matched && !ROUTE_ROLES[matched].includes(payload.role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
