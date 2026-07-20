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
