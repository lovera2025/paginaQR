import { NextResponse } from "next/server";
import { getEventoById, getOrden } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Estado de una compra + resumen de la fiesta (para las pantallas de pago y éxito). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const orden = await getOrden(params.id);
  if (!orden) {
    return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
  }
  const evento = await getEventoById(orden.eventoId);
  return NextResponse.json({
    ...orden,
    evento: evento
      ? {
          nombre: evento.nombre,
          slug: evento.slug,
          fecha: evento.fecha,
          lugar: evento.lugar,
          flyerUrl: evento.flyerUrl,
          colorPrimario: evento.colorPrimario,
          colorSecundario: evento.colorSecundario,
        }
      : null,
  });
}
