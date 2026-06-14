import { NextResponse } from "next/server";
import { resetVentasEventoActivo } from "@/lib/db";
import { requireRole } from "@/lib/auth/cookies";

export async function POST(request: Request) {
  if (!requireRole("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.confirmacion !== "REINICIAR") {
    return NextResponse.json(
      { error: 'Escribí REINICIAR para confirmar' },
      { status: 400 }
    );
  }

  const result = await resetVentasEventoActivo();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
