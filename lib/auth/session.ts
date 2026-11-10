import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AuthRole = "admin" | "scanner";

export interface AuthSession {
  role: AuthRole;
  pinRevision: number;
  /** Vencimiento (ms epoch). */
  exp: number;
}

export const SESSION_MS = 12 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __authSecretLocal: string | undefined;
}

/**
 * Clave para firmar la sesión. En producción sale de AUTH_SECRET o, si no está,
 * de la service role de Supabase (nunca llega al navegador). En local sin ninguna
 * de las dos se usa una clave al azar por proceso (al reiniciar hay que volver a entrar).
 */
export function authSecret(): string {
  const env = process.env.AUTH_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (env) return env;
  if (!global.__authSecretLocal) global.__authSecretLocal = randomBytes(32).toString("hex");
  return global.__authSecretLocal;
}

function firma(datos: string, secret: string): string {
  return createHmac("sha256", secret).update(datos).digest("base64url");
}

/** Valor de la cookie: rol:revisión:vencimiento:firma */
export function firmarSesion(role: AuthRole, pinRevision: number, now = Date.now(), secret = authSecret()): string {
  const datos = `${role}:${pinRevision}:${now + SESSION_MS}`;
  return `${datos}:${firma(datos, secret)}`;
}

/** Devuelve la sesión solo si la firma es válida y no venció. */
export function leerSesion(value: string | undefined, now = Date.now(), secret = authSecret()): AuthSession | null {
  if (!value) return null;
  const partes = value.split(":");
  if (partes.length !== 4) return null;
  const [role, revStr, expStr, sig] = partes;
  if (role !== "admin" && role !== "scanner") return null;
  const pinRevision = Number(revStr);
  const exp = Number(expStr);
  if (!Number.isInteger(pinRevision) || !Number.isFinite(exp)) return null;

  const esperada = Buffer.from(firma(`${role}:${revStr}:${expStr}`, secret));
  const recibida = Buffer.from(sig);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  if (now > exp) return null;
  return { role, pinRevision, exp };
}

/** Compara PINs sin filtrar por tiempo cuántos caracteres coinciden. */
export function pinIgual(a: string, b: string): boolean {
  const x = Buffer.from(createHmac("sha256", "pin").update(a).digest());
  const y = Buffer.from(createHmac("sha256", "pin").update(b).digest());
  return timingSafeEqual(x, y) && a.length > 0;
}
