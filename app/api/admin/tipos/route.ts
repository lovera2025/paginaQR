import { NextResponse } from "next/server";
import { createTipo, getTiposByEvento, getTiposDisponibles } from "@/lib/db";
import { adminConEvento, errorJson } from "@/lib/api/admin";
import { normalizarTipoInput } from "@/lib/entradas/tipos";
import type { TipoEntradaInput } from "@/types";

export async function GET(request: Request) {
  const ctx = await adminConEvento(request);
  if ("response" in ctx) return ctx.response;
  return NextResponse.json({ tipos: await getTiposDisponibles(ctx.evento.id) });
}

export async function POST(request: Request) {
  const body = await request.json();
  const ctx = await adminConEvento(request, body.eventoId);
  if ("response" in ctx) return ctx.response;

  const parsed = normalizarTipoInput(body, false);
  if ("error" in parsed) return errorJson(parsed.error);

  const existentes = await getTiposByEvento(ctx.evento.id);
  const input = {
    ...parsed.value,
    orden: body.orden === undefined ? existentes.length : parsed.value.orden,
  } as TipoEntradaInput;

  const result = await createTipo(ctx.evento.id, input);
  if ("error" in result) return errorJson(result.error);
  return NextResponse.json({ tipo: result });
}
