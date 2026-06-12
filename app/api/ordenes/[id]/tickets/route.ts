import { NextResponse } from "next/server";
import { getOrden, getTicketsByOrden } from "@/lib/db";
import { generateQrDataUrl } from "@/lib/qr/generate";

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
  const withQr = await Promise.all(
    tickets.map(async (ticket) => ({
      ...ticket,
      qrDataUrl: await generateQrDataUrl(ticket.id),
    }))
  );

  return NextResponse.json({ tickets: withQr, orden });
}
