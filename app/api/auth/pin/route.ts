import { NextResponse } from "next/server";
import { setAuthCookie, type AuthRole } from "@/lib/auth/cookies";
import { getAppPins } from "@/lib/auth/pins";
import { pinIgual } from "@/lib/auth/session";

/**
 * Login staff con un solo PIN: si coincide con el de admin entra como jefe,
 * si coincide con el de scanner entra como puerta.
 * (Compatibilidad: si viene `role`, solo valida ese rol.)
 */
// Límite de intentos fallidos por IP (en memoria del servidor: frena probar PINs a lo bruto).
const VENTANA_MS = 10 * 60 * 1000;
const MAX_FALLOS = 8;
declare global {
  // eslint-disable-next-line no-var
  var __pinFallos: Map<string, { n: number; desde: number }> | undefined;
}
function fallos() {
  if (!global.__pinFallos) global.__pinFallos = new Map();
  return global.__pinFallos;
}
function ipDe(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: Request) {
  const ip = ipDe(request);
  const registro = fallos().get(ip);
  const ahora = Date.now();
  if (registro && ahora - registro.desde < VENTANA_MS && registro.n >= MAX_FALLOS) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { pin?: string; role?: AuthRole };
  const pin = String(body.pin ?? "").trim();
  if (!pin) {
    return NextResponse.json({ error: "Ingresá el PIN" }, { status: 400 });
  }

  const pins = await getAppPins();
  const esAdmin = pinIgual(pin, pins.adminPin);
  const esScanner = pinIgual(pin, pins.scannerPin);
  let role: AuthRole | null = null;
  if (body.role === "admin") role = esAdmin ? "admin" : null;
  else if (body.role === "scanner") role = esAdmin ? "admin" : esScanner ? "scanner" : null;
  else if (esAdmin) role = "admin";
  else if (esScanner) role = "scanner";

  if (!role) {
    const previo = fallos().get(ip);
    const vigente = previo && ahora - previo.desde < VENTANA_MS;
    fallos().set(ip, { n: vigente ? previo!.n + 1 : 1, desde: vigente ? previo!.desde : ahora });
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  fallos().delete(ip);
  setAuthCookie(role, pins.pinRevision);
  return NextResponse.json({ ok: true, role });
}
