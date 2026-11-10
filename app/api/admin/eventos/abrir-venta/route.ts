import { NextResponse } from "next/server";
import { abrirVentaPublicadas, registrarActividad } from "@/lib/db";
import { errorJson, noAutorizado } from "@/lib/api/admin";
import { requireAuth } from "@/lib/auth/cookies";
import { cobraDeVerdad, getModoPagos } from "@/lib/payments/modo";

/**
 * Abre la venta en todas las fiestas publicadas que están en "Próximamente".
 * Solo con cobros reales conectados: si no, la gente entraría a comprar sin poder pagar (o pagando de prueba).
 */
export async function POST() {
  if (!(await requireAuth("admin"))) return noAutorizado();

  if (!cobraDeVerdad(await getModoPagos())) {
    return errorJson("Primero conectá Mercado Pago con cobros reales (pestaña Pagos).");
  }

  const { abiertas } = await abrirVentaPublicadas();
  if (abiertas.length > 0) {
    await registrarActividad("venta", `Venta abierta en ${abiertas.length} ${abiertas.length === 1 ? "fiesta" : "fiestas"}`);
  }
  return NextResponse.json({ abiertas: abiertas.length });
}
