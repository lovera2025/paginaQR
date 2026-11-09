import { NextResponse } from "next/server";
import { getOrden, getTicketsByOrden } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

/** Detalle de una compra para el panel (incluye entradas anuladas y usadas). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const orden = await getOrden(params.id);
  if (!orden) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
  return NextResponse.json({ orden, tickets: await getTicketsByOrden(orden.id) });
}
