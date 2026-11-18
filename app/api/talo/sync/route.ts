import { NextResponse } from "next/server";
import { isPaymentMethodAvailable } from "@/lib/payments/methods";
import { syncTaloPaymentForOrden } from "@/lib/talo/payments";

export const dynamic = "force-dynamic";

/** Consulta en Talo los pagos de una compra (la usan la pantalla de pago, la de éxito y Mis entradas). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ordenId = String(body.ordenId ?? "").trim();

  if (!ordenId) {
    return NextResponse.json({ error: "Orden requerida" }, { status: 400 });
  }
  // Sin Talo activo no hay nada que consultar (la pantalla de éxito pregunta igual).
  if (!(await isPaymentMethodAvailable("talo"))) {
    return NextResponse.json({ ok: true, status: null });
  }

  const result = await syncTaloPaymentForOrden(ordenId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status: result.status ?? null, recibido: result.recibido ?? null });
}
