import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { getOrden } from "@/lib/db";
import { syncMpPaymentForOrden } from "@/lib/mercadopago/payments";
import { isPaymentMethodAvailable } from "@/lib/payments/methods";
import { syncTaloPaymentForOrden } from "@/lib/talo/payments";

export const dynamic = "force-dynamic";

/**
 * Consulta en Mercado Pago / Talo si una compra pendiente en realidad se pagó
 * (ej. "pagué y no me llegó nada"). Si está paga, emite las entradas y manda el mail.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const antes = await getOrden(params.id);
  if (!antes) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });
  if (antes.estado !== "pendiente" && antes.estado !== "rechazado") {
    return NextResponse.json({ orden: antes, cambio: false });
  }

  const errores: string[] = [];
  if (antes.paymentMethod === "talo" && antes.paymentId) {
    const r = await syncTaloPaymentForOrden(antes.id);
    if ("error" in r) errores.push(`Talo: ${r.error}`);
  } else if (await isPaymentMethodAvailable("mp")) {
    const r = await syncMpPaymentForOrden(antes.id);
    if ("error" in r) errores.push(`Mercado Pago: ${r.error}`);
  } else {
    errores.push("No hay medios de pago configurados para consultar");
  }

  const orden = await getOrden(params.id);
  return NextResponse.json({
    orden,
    cambio: orden?.estado !== antes.estado || orden?.problema !== antes.problema,
    error: errores[0] ?? null,
  });
}
