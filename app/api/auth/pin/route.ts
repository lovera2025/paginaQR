import { NextResponse } from "next/server";
import { setAuthCookie, type AuthRole } from "@/lib/auth/cookies";
import { getAppPins } from "@/lib/auth/pins";

/**
 * Login staff con un solo PIN: si coincide con el de admin entra como jefe,
 * si coincide con el de scanner entra como puerta.
 * (Compatibilidad: si viene `role`, solo valida ese rol.)
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { pin?: string; role?: AuthRole };
  const pin = String(body.pin ?? "").trim();
  if (!pin) {
    return NextResponse.json({ error: "Ingresá el PIN" }, { status: 400 });
  }

  const pins = await getAppPins();
  let role: AuthRole | null = null;
  if (body.role === "admin") role = pin === pins.adminPin ? "admin" : null;
  else if (body.role === "scanner") role = pin === pins.scannerPin || pin === pins.adminPin ? (pin === pins.adminPin ? "admin" : "scanner") : null;
  else if (pin === pins.adminPin) role = "admin";
  else if (pin === pins.scannerPin) role = "scanner";

  if (!role) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  setAuthCookie(role, pins.pinRevision);
  return NextResponse.json({ ok: true, role });
}
