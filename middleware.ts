import { NextRequest, NextResponse } from "next/server";

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
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublic) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const token = req.cookies.get("auth-token")?.value;

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
