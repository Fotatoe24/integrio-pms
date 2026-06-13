import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "integrio-dev-secret";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword);
}

export function createToken(payload: {
  id: string;
  email: string;
  role: string;
}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
    };
  } catch {
    return null;
  }
}

// ── Client-side helpers (browser only) ──────────────────────────────────────

export interface IntegrioUser {
  id: string;
  email: string;
  name: string;
  role: string;
  owner_id: string | null;
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
    const roleRoutes: Record<string, string> = {
      owner: "/owner",
      booker: "/dashboard",
      auditor: "/auditor",
      housekeeping: "/housekeeping",
      ADMIN: "/owner",
      STAFF: "/dashboard",
    };
    router.push(roleRoutes[user.role] ?? "/login");
    return null;
  }

  return user;
}
