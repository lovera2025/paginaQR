import { NextResponse } from "next/server";
import { getEventoBySlug, getEventoCatalogo } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const evento = await getEventoBySlug(params.slug);
  const visible =
    evento && (evento.estado === "venta" || evento.estado === "pausado" || (await requireAuth("admin")));
  if (!evento || !visible) {
    return NextResponse.json({ error: "Fiesta no encontrada" }, { status: 404 });
  }
  return NextResponse.json(await getEventoCatalogo(evento.id));
}
