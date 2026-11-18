import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { getOrden } from "@/lib/db";
import { revisarPago } from "@/lib/payments/revisar";
import { ordenAdmin } from "@/lib/entradas/publica";

export const dynamic = "force-dynamic";

/**
 * Consulta en Mercado Pago / Talo si una compra pendiente en realidad se pagó
 * (ej. "pagué y no me llegó nada"). Si está paga, emite las entradas.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const antes = await getOrden(params.id);
  if (!antes) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
  if (antes.estado !== "pendiente" && antes.estado !== "rechazado") {
    return NextResponse.json({ orden: ordenAdmin(antes), cambio: false });
  }

  const { orden, cambio, error } = await revisarPago(antes);
  return NextResponse.json({ orden: ordenAdmin(orden), cambio, error });
}
