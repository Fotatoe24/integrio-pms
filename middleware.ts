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
  "/api/auth/login",
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

// ROUTE_ROLES keys are the new-style routes (e.g. /dashboard/financials).
// Some of your actual pages still live under different paths (e.g. the
// owner dashboard is /owner, not /dashboard/admin) — matched by longest
// prefix below so a more specific rule always wins over a shorter one.
function findRouteRule(pathname: string): string | null {
  const matches = Object.keys(ROUTE_ROLES).filter((route) =>
    pathname.startsWith(route)
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.length - a.length)[0];
}

// Kept in sync with ROLE_HOME_ROUTES in login/page.tsx and the roleRoutes
// map in change-password/page.tsx. Accepts both new uppercase roles and
// old lowercase ones in case User.role rows haven't fully migrated yet.
const ROLE_HOME_ROUTES: Record<string, string> = {
  OWNER_ADMIN: "/owner",
  CO_OWNER: "/owner",
  BOOKER: "/dashboard",
  AUDITOR: "/auditor",
  HOUSEKEEPING: "/housekeeping",
  ADMIN: "/owner",
  STAFF: "/dashboard",
  owner: "/owner",
  booker: "/dashboard",
  auditor: "/auditor",
  housekeeping: "/housekeeping",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublic) {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth-token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = await verifyToken(token);

  if (!payload) {
    // Cookie present but invalid/expired — treat as logged out.
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("auth-token");
    return response;
  }

  const routeRule = findRouteRule(pathname);
  if (routeRule) {
    const allowedRoles = ROUTE_ROLES[routeRule];
    if (!allowedRoles.includes(payload.role)) {
      // Authenticated, but not allowed on this route — bounce to their
      // own home instead of /login, since they ARE logged in.
      const home = ROLE_HOME_ROUTES[payload.role] ?? "/dashboard";
      return NextResponse.redirect(new URL(home, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
