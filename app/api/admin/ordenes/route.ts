import { NextResponse } from "next/server";
import { getOrdenes } from "@/lib/db";
import { adminConEvento } from "@/lib/api/admin";
import { ordenAdmin } from "@/lib/entradas/publica";

export async function GET(request: Request) {
  const ctx = await adminConEvento(request);
  if ("response" in ctx) return ctx.response;
  // La fecha de nacimiento no se muestra en ningún lado (es solo para "Recuperar mis entradas").
  return NextResponse.json({ ordenes: (await getOrdenes(ctx.evento.id)).map(ordenAdmin) });
}
