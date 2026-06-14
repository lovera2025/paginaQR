import { NextResponse } from "next/server";
import { getOrden, getTicketsByOrden } from "@/lib/db";

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

  const tickets = (await getTicketsByOrden(params.id)).filter((t) => !t.cancelado);

  return NextResponse.json({ tickets, orden });
}
