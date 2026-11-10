import { NextResponse } from "next/server";
import { getBranding, getEventoById, getOrden, getTicket } from "@/lib/db";
import { buildTicketPdf, nombreArchivoPdf } from "@/lib/pdf/ticket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PDF de una sola entrada (por su ID, que no se puede adivinar). */
export async function GET(request: Request, { params }: { params: { ticketId: string } }) {
  const ticket = await getTicket(params.ticketId);
  if (!ticket) return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
  if (ticket.cancelado) return NextResponse.json({ error: "Esta entrada fue anulada" }, { status: 410 });

  const orden = await getOrden(ticket.ordenId);
  if (!orden || (orden.estado !== "aprobado" && orden.estado !== "reembolsado")) {
    return NextResponse.json({ error: "El pago todavía no está confirmado" }, { status: 409 });
  }

  const [evento, branding] = await Promise.all([getEventoById(ticket.eventoId), getBranding()]);
  if (!evento) return NextResponse.json({ error: "Fiesta no encontrada" }, { status: 404 });

  const pdf = await buildTicketPdf({
    evento,
    orden,
    tickets: [ticket],
    branding,
    origin: new URL(request.url).origin,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivoPdf(evento, `${ticket.numeroEntrada}-de-${ticket.totalEntradas}`)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
