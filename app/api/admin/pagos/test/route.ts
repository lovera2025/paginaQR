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
    return NextResponse.json({
      ok: true,
      message: "Conexión con Mercado Pago OK",
      environment: result.environment,
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
