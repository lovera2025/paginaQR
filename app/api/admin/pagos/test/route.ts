import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { testMpConnection } from "@/lib/mercadopago/credentials";
import { testTaloConnection } from "@/lib/talo/payments";

export async function POST(request: Request) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const provider = body.provider === "mp" ? "mp" : "talo";

  if (provider === "mp") {
    const result = await testMpConnection();
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const esPrueba = result.tokenTipo === "prueba";
    const noCoincide =
      (result.environment === "sandbox" && result.tokenTipo === "produccion") ||
      (result.environment === "production" && esPrueba);
    return NextResponse.json({
      ok: true,
      message: esPrueba
        ? "Cuenta de prueba conectada · no se cobra de verdad"
        : result.tokenTipo === "produccion"
          ? "Cuenta conectada · cobros reales"
          : "Cuenta conectada",
      environment: result.environment,
      tokenTipo: result.tokenTipo,
      advertencia: noCoincide
        ? "La clave y el tipo de cobro guardado no coinciden. Volvé a pegar la clave y tocá Guardar y verificar."
        : null,
    });
  }

  const result = await testTaloConnection();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Conexión con Talo OK",
    environment: result.environment,
  });
}
