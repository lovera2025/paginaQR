import { NextResponse } from "next/server";
import { resetVentas } from "@/lib/db";
import { adminConEvento, errorJson } from "@/lib/api/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ctx = await adminConEvento(request, body.eventoId);
  if ("response" in ctx) return ctx.response;

  if (body.confirmacion !== "REINICIAR") return errorJson("Escribí REINICIAR para confirmar");

  const result = await resetVentas(ctx.evento.id);
  if ("error" in result) return errorJson(result.error);
  return NextResponse.json({ ok: true });
}
