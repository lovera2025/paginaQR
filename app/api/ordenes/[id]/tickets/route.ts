import { NextResponse } from "next/server";
import { getEventoById, getOrden, getTicketsByOrden } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const orden = await getOrden(params.id);
  if (!orden) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  if (orden.estado !== "aprobado") {
    return NextResponse.json({ error: "Pago no confirmado" }, { status: 400 });
  }

  const tickets = (await getTicketsByOrden(params.id)).sort(
    (a, b) => a.numeroEntrada - b.numeroEntrada
  );
  const evento = await getEventoById(orden.eventoId);

  if (!evento) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ tickets, orden, evento });
}
