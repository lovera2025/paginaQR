import { NextResponse } from "next/server";
import { setAuthCookie, type AuthRole } from "@/lib/auth/cookies";
import { getAppPins, isWeakPin } from "@/lib/auth/pins";
import { getAppMode } from "@/lib/config";
import { pinIgual } from "@/lib/auth/session";
import { crearLimite, ipDe } from "@/lib/limite";

/**
 * Login staff con un solo PIN: si coincide con el de admin entra como jefe,
 * si coincide con el de scanner entra como puerta.
 * (Compatibilidad: si viene `role`, solo valida ese rol.)
 */
// Límite de intentos fallidos por IP: 8 cada 10 minutos (frena probar PINs a lo bruto).
const fallos = crearLimite("pin", 8, 10 * 60 * 1000);

export async function POST(request: Request) {
  const ip = ipDe(request);
  if (fallos.bloqueado(ip)) {
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
  // En producción un PIN débil (1234 o menos de 6 caracteres, ej. el de prueba que queda si no se
  // configuró ninguno) nunca abre sesión: cualquiera lo adivinaría.
  const prod = getAppMode() === "production";
  const adminValido = !(prod && isWeakPin(pins.adminPin));
  const scannerValido = !(prod && isWeakPin(pins.scannerPin));
  if (!adminValido && !scannerValido) {
    return NextResponse.json(
      {
        error:
          "Falta configurar PINs seguros: cargá ADMIN_PIN y SCANNER_PIN (6 o más dígitos, distintos) en Vercel y volvé a desplegar.",
      },
      { status: 503 }
    );
  }
  const esAdmin = adminValido && pinIgual(pin, pins.adminPin);
  const esScanner = scannerValido && pinIgual(pin, pins.scannerPin);
  let role: AuthRole | null = null;
  if (body.role === "admin") role = esAdmin ? "admin" : null;
  else if (body.role === "scanner") role = esAdmin ? "admin" : esScanner ? "scanner" : null;
  else if (esAdmin) role = "admin";
  else if (esScanner) role = "scanner";

  if (!role) {
    fallos.sumar(ip);
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  fallos.limpiar(ip);
  setAuthCookie(role, pins.pinRevision);
  return NextResponse.json({ ok: true, role });
}
