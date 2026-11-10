import { NextResponse } from "next/server";
import { reordenarTipos } from "@/lib/db";
import { adminConEvento, errorJson } from "@/lib/api/admin";

export async function POST(request: Request) {
  const body = await request.json();
  const ctx = await adminConEvento(request, body.eventoId);
  if ("response" in ctx) return ctx.response;
  if (!Array.isArray(body.ids)) return errorJson("ids requerido");
  await reordenarTipos(ctx.evento.id, body.ids.map(String));
  return NextResponse.json({ ok: true });
}
