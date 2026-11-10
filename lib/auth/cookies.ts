import { cookies } from "next/headers";
import { getAppPins } from "@/lib/auth/pins";
import { firmarSesion, leerSesion, SESSION_MS, type AuthRole, type AuthSession } from "@/lib/auth/session";

export type { AuthRole, AuthSession } from "@/lib/auth/session";

const COOKIE_NAME = "pq_auth";

export function setAuthCookie(role: AuthRole, pinRevision: number) {
  cookies().set(COOKIE_NAME, firmarSesion(role, pinRevision), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export function clearAuthCookie() {
  cookies().delete(COOKIE_NAME);
}

/** Sesión firmada y vigente (null si no hay, si fue alterada o si venció). */
export function getAuthSession(): AuthSession | null {
  return leerSesion(cookies().get(COOKIE_NAME)?.value);
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
