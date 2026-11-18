import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { cerrarPagoSinCupo, getEventoById, getOrden, registrarActividad, resolverPagoDoble } from "@/lib/db";
import { ordenAdmin } from "@/lib/entradas/publica";
import { formatPrecio } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** El jefe ya le devolvió la plata a alguien cuyo pago entró sin entradas disponibles. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // Pago doble: la compra sigue pagada con sus entradas; solo se registra que se devolvió el otro pago.
  const antes = await getOrden(params.id);
  if (antes?.problema === "pago_doble") {
    const r = await resolverPagoDoble(params.id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const ev = await getEventoById(r.orden.eventoId);
    await registrarActividad(
      "reembolso",
      `Devolución ${ev?.slug ?? ""}: ${r.orden.compradorNombre}, pago doble de la compra ${r.orden.id.slice(0, 8).toUpperCase()} (las entradas siguen válidas)`
    );
    return NextResponse.json({ orden: ordenAdmin(r.orden) });
  }

  const result = await cerrarPagoSinCupo(params.id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const { orden } = result;
  const evento = await getEventoById(orden.eventoId);
  await registrarActividad(
    "reembolso",
    `Devolución ${evento?.slug ?? ""}: ${orden.compradorNombre}, ${formatPrecio(orden.montoTotal)} (pago que entró sin cupo, compra ${orden.id.slice(0, 8).toUpperCase()})`
  );
  return NextResponse.json({ orden: ordenAdmin(orden) });
}
