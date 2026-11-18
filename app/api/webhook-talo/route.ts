import { NextResponse } from "next/server";
import { getOrden, registrarActividad } from "@/lib/db";
import { getTaloClient } from "@/lib/talo/client";
import { idCortoTalo, processTaloPayment } from "@/lib/talo/payments";

export const dynamic = "force-dynamic";

const ESTADOS: Record<string, string> = {
  PENDING: "esperando la transferencia",
  SUCCESS: "transferencia recibida",
  OVERPAID: "transferencia recibida (de más)",
  UNDERPAID: "transferencia de menos",
  EXPIRED: "alias vencido",
};

/** Aviso automático de Talo: `{ message, paymentId, externalId }`. */
export async function POST(request: Request) {
  let body: { paymentId?: string; externalId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const paymentId = body.paymentId?.trim();
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId requerido" }, { status: 400 });
  }

  const taloResult = await getTaloClient();
  if ("error" in taloResult) {
    console.error("[Talo webhook] sin credenciales:", taloResult.error);
    return NextResponse.json({ ok: true });
  }

  // Si falla algo momentáneo (base, red) se responde 500 para que Talo reintente el aviso
  // y la transferencia no quede acreditada sin entradas.
  try {
    // Siempre se consulta el pago en Talo: el aviso en sí no se usa como prueba de pago.
    const payment = await taloResult.client.payments.get(paymentId);
    // Queda anotado en Actividad para saber que los avisos llegan, solo cuando trae novedades
    // (no se anotan los "esperando" ni los repetidos de una compra que ya está paga con ese pago).
    const orden = payment.external_id ? await getOrden(payment.external_id) : undefined;
    const repetido = orden?.estado === "aprobado" && orden.paymentId === payment.id;
    if (orden && payment.payment_status !== "PENDING" && !repetido) {
      await registrarActividad(
        "pago",
        `Aviso automático de Talo (${idCortoTalo(paymentId)}) · compra ${orden.id.slice(0, 8)} → ${
          ESTADOS[payment.payment_status] ?? payment.payment_status
        }`
      );
    }
    const result = await processTaloPayment(payment);
    if ("error" in result) {
      console.error("[Talo webhook] error procesando:", result.error);
      if (result.reintentar) return NextResponse.json({ error: "Reintentar" }, { status: 500 });
    }
  } catch (error) {
    console.error("[Talo webhook] error consultando pago:", error);
    return NextResponse.json({ error: "Reintentar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
