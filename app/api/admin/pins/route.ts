import { NextResponse } from "next/server";
import { clearAuthCookie, requireAuth } from "@/lib/auth/cookies";
import { changeAppPins } from "@/lib/auth/pins";

export async function POST(request: Request) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const pinActual = String(body.pinActual ?? "");
  const pinAdminNuevo = String(body.pinAdminNuevo ?? "");
  const pinScannerNuevo = String(body.pinScannerNuevo ?? "");

  if (!pinActual || !pinAdminNuevo || !pinScannerNuevo) {
    return NextResponse.json(
      { error: "Completá todos los campos" },
      { status: 400 }
    );
  }

  const result = await changeAppPins({
    pinActual,
    pinAdminNuevo,
    pinScannerNuevo,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  clearAuthCookie();
  return NextResponse.json({
    ok: true,
    pinRevision: result.pinRevision,
    message: "PIN actualizado. Ingresá con el PIN nuevo.",
  });
}
