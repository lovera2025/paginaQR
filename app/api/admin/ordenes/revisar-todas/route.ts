import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { getOrdenesPendientesDesde } from "@/lib/db";
import { revisarPago } from "@/lib/payments/revisar";
import { idsTaloDe } from "@/lib/talo/payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Revisa de una vez las compras sin pagar con una transferencia o pago iniciado (de todas las fiestas)
 * de los últimos `dias` días (por defecto 2). Las que estaban pagas pasan a Pagada y se emiten las entradas.
 */
export async function POST(request: Request) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const dias = Math.min(10, Math.max(1, Number(body.dias) || 2));
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  // Solo las que llegaron a iniciar un pago (las abandonadas antes de pagar no tienen nada que consultar).
  const pendientes = (await getOrdenesPendientesDesde(desde)).filter(
    (o) => idsTaloDe(o).length > 0 || o.paymentMethod === "mp"
  );

  let pagadas = 0;
  let sinCupo = 0;
  let deMenos = 0;
  let errores = 0;
  // De a 4 para no saturar a Talo ni pasarse del tiempo máximo.
  for (let i = 0; i < pendientes.length; i += 4) {
    const tanda = await Promise.all(pendientes.slice(i, i + 4).map((o) => revisarPago(o)));
    for (const r of tanda) {
      if (r.error) errores += 1;
      if (r.orden.estado === "aprobado") pagadas += 1;
      else if (r.orden.problema === "pago_sin_cupo") sinCupo += 1;
      else if (r.orden.montoRecibido != null) deMenos += 1;
    }
  }

  return NextResponse.json({ revisadas: pendientes.length, pagadas, sinCupo, deMenos, errores });
}
