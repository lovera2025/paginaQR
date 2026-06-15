import { cookies } from "next/headers";
import { getAppPins } from "@/lib/auth/pins";

export type AuthRole = "admin" | "scanner";

const COOKIE_NAME = "pq_auth";

export interface AuthSession {
  role: AuthRole;
  pinRevision: number;
}

function parseCookie(value: string | undefined): AuthSession | null {
  if (!value) return null;
  const [role, revStr] = value.split(":");
  if (role !== "admin" && role !== "scanner") return null;
  const pinRevision = Number(revStr);
  if (!Number.isFinite(pinRevision)) return null;
  return { role, pinRevision };
}

export function setAuthCookie(role: AuthRole, pinRevision: number) {
  cookies().set(COOKIE_NAME, `${role}:${pinRevision}`, {
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

export function getAuthSession(): AuthSession | null {
  return parseCookie(cookies().get(COOKIE_NAME)?.value);
}

/** @deprecated use getAuthSession */
export function getAuthRole(): AuthRole | null {
  return getAuthSession()?.role ?? null;
}

export async function isSessionValid(): Promise<boolean> {
  const session = getAuthSession();
  if (!session) return false;
  const pins = await getAppPins();
  return session.pinRevision === pins.pinRevision;
}

export async function requireAuth(role: AuthRole): Promise<boolean> {
  const session = getAuthSession();
  if (!session) return false;

  const pins = await getAppPins();
  if (session.pinRevision !== pins.pinRevision) return false;

  if (role === "admin") return session.role === "admin";
  return session.role === "scanner" || session.role === "admin";
}

/** @deprecated use requireAuth */
export function requireRole(role: AuthRole): boolean {
  const session = getAuthSession();
  if (!session) return false;
  if (role === "admin") return session.role === "admin";
  return session.role === "scanner" || session.role === "admin";
}
