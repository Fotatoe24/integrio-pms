import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "integrio-dev-secret"
);

// ── Roles (from Evangelina) ─────────────────────────────────────────
// Kept your original ADMIN/STAFF as aliases so any old rows/checks
// still work while you migrate users over to the new role set.
export type Role =
  | "OWNER_ADMIN"
  | "CO_OWNER"
  | "HOUSEKEEPING"
  | "BOOKER"
  | "AUDITOR"
  | "ADMIN"
  | "STAFF";

// Which roles can reach which top-level routes. Checked in middleware.ts.
// A route not listed here is reachable by any authenticated user.
export const ROUTE_ROLES: Record<string, Role[]> = {
  "/dashboard/financials": ["OWNER_ADMIN", "CO_OWNER", "ADMIN"],
  "/dashboard/reports": ["OWNER_ADMIN", "CO_OWNER", "ADMIN"],
  "/dashboard/bookings": [
    "OWNER_ADMIN",
    "CO_OWNER",
    "HOUSEKEEPING",
    "BOOKER",
    "ADMIN",
    "STAFF",
  ],
  "/dashboard/calendar": [
    "OWNER_ADMIN",
    "CO_OWNER",
    "HOUSEKEEPING",
    "BOOKER",
    "ADMIN",
    "STAFF",
  ],
  "/dashboard/housekeeping": [
    "OWNER_ADMIN",
    "CO_OWNER",
    "HOUSEKEEPING",
    "ADMIN",
  ],
  "/dashboard/auditor": ["OWNER_ADMIN", "AUDITOR", "CO_OWNER", "ADMIN"],
  "/dashboard/admin": ["OWNER_ADMIN", "ADMIN"],
  "/dashboard/earnings": [
    "OWNER_ADMIN",
    "CO_OWNER",
    "HOUSEKEEPING",
    "BOOKER",
    "AUDITOR",
    "ADMIN",
    "STAFF",
  ],
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword);
}

export interface TokenPayload {
  id: string;
  email: string;
  username?: string | null;
  name: string;
  role: Role;
  avatarColor?: string;
  mustChangePassword?: boolean;
}

export async function createToken(payload: TokenPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

// ── Client-side helpers (browser only) ──────────────────────────────
// These read the cached user object that /login writes to localStorage
// after a successful sign-in. They do NOT re-verify the JWT — that only
// happens server-side (middleware.ts / API routes via verifyToken above).
// Restored here because app/dashboard/**, app/settings, app/auditor,
// app/housekeeping, and app/change-password all import these directly.

export interface IntegrioUser {
  id: string;
  email: string;
  username?: string | null;
  name: string;
  // Intentionally NOT typed as `Role` here (unlike TokenPayload, which is
  // what the server signs into the JWT). This is the loosely-typed object
  // read back from localStorage on the client, and most pages still
  // compare it against the old lowercase role strings ("owner", "booker",
  // "auditor", "housekeeping") while the DB migration to the new
  // OWNER_ADMIN/CO_OWNER/etc. set is in progress. Locking this to `Role`
  // breaks every one of those comparisons with a TS2367 error.
  role: string;
  owner_id: string | null;
  avatarColor?: string;
  mustChangePassword?: boolean;
}

export function getCurrentUser(): IntegrioUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("integrio_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Maps a role to its "home" route. Kept in sync with ROUTE_ROLES above
// and with the roleRoutes maps duplicated in login/page.tsx and
// change-password/page.tsx — if you add a role, update all three.
const ROLE_HOME_ROUTES: Record<string, string> = {
  OWNER_ADMIN: "/owner",
  CO_OWNER: "/owner",
  BOOKER: "/dashboard",
  AUDITOR: "/auditor",
  HOUSEKEEPING: "/housekeeping",
  ADMIN: "/owner",
  STAFF: "/dashboard",
};

export function requireRole(
  allowedRoles: string[],
  router: { push: (path: string) => void }
): IntegrioUser | null {
  const user = getCurrentUser();

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    router.push(ROLE_HOME_ROUTES[user.role] ?? "/login");
    return null;
  }

  return user;
}
