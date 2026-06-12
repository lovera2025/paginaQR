import { cookies } from "next/headers";

export type AuthRole = "admin" | "scanner";

const COOKIE_NAME = "pq_auth";

export function setAuthCookie(role: AuthRole) {
  cookies().set(COOKIE_NAME, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export function clearAuthCookie() {
  cookies().delete(COOKIE_NAME);
}

export function getAuthRole(): AuthRole | null {
  const value = cookies().get(COOKIE_NAME)?.value;
  if (value === "admin" || value === "scanner") return value;
  return null;
}

export function requireRole(role: AuthRole): boolean {
  const current = getAuthRole();
  if (role === "admin") return current === "admin";
  return current === "scanner" || current === "admin";
}
