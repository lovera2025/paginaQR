import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { cerrarPagoSinCupo, getEventoById, registrarActividad } from "@/lib/db";
import { formatPrecio } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** El jefe ya le devolvió la plata a alguien cuyo pago entró sin entradas disponibles. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const result = await cerrarPagoSinCupo(params.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const { orden } = result;
  const evento = await getEventoById(orden.eventoId);
  await registrarActividad(
    "reembolso",
    `Devolución ${evento?.slug ?? ""}: ${orden.compradorNombre}, ${formatPrecio(orden.montoTotal)} (pago que entró sin cupo, compra ${orden.id.slice(0, 8).toUpperCase()})`
  );
  return NextResponse.json({ orden });
}
