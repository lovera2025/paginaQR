import { NextResponse } from "next/server";
import { getBranding, getEventoById, getOrden, getTicketsByOrden } from "@/lib/db";
import { buildTicketPdf, nombreArchivoPdf } from "@/lib/pdf/ticket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PDF con todas las entradas activas de una compra (solo con pago confirmado). */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const orden = await getOrden(params.id);
  if (!orden) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
  if (orden.estado !== "aprobado") {
    return NextResponse.json({ error: "El pago todavía no está confirmado" }, { status: 409 });
  }

  const [evento, tickets, branding] = await Promise.all([
    getEventoById(orden.eventoId),
    getTicketsByOrden(orden.id),
    getBranding(),
  ]);
  if (!evento) return NextResponse.json({ error: "Fiesta no encontrada" }, { status: 404 });

  const activas = tickets.filter((t) => !t.cancelado).sort((a, b) => a.numeroEntrada - b.numeroEntrada);
  if (activas.length === 0) {
    return NextResponse.json({ error: "No hay entradas activas en esta compra" }, { status: 410 });
  }

  const pdf = await buildTicketPdf({
    evento,
    orden,
    tickets: activas,
    branding,
    origin: new URL(request.url).origin,
  });

  const inline = new URL(request.url).searchParams.get("ver") === "1";
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${nombreArchivoPdf(evento, orden.id.slice(0, 8))}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
