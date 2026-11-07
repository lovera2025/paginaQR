import { NextResponse } from "next/server";
import { getBranding, getEventoById, getOrden, getTicketsByOrden } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Entradas de una compra. Solo se liberan con el pago confirmado. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const orden = await getOrden(params.id);
  if (!orden) {
    return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
  }
  if (orden.estado !== "aprobado" && orden.estado !== "reembolsado") {
    return NextResponse.json({ error: "Pago no confirmado", estado: orden.estado }, { status: 409 });
  }

  const [tickets, evento, branding] = await Promise.all([
    getTicketsByOrden(params.id),
    getEventoById(orden.eventoId),
    getBranding(),
  ]);
  if (!evento) {
    return NextResponse.json({ error: "Fiesta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    tickets: tickets.sort((a, b) => a.numeroEntrada - b.numeroEntrada),
    orden,
    evento,
    branding,
  });
}
