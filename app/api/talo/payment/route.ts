import { NextResponse } from "next/server";
import { getEventoById, getOrden, setOrdenPaymentId } from "@/lib/db";
import { createTaloPaymentForOrden, idsTaloDe, syncTaloPaymentForOrden } from "@/lib/talo/payments";

import { isPaymentMethodAvailable } from "@/lib/payments/methods";
import { MENSAJE_RESERVA_VENCIDA, reservaVencida } from "@/lib/payments/reserva";

export const dynamic = "force-dynamic";

/**
 * Datos para transferir con Talo. Si la compra ya tiene una transferencia iniciada, primero se fija
 * si se pagó: la pantalla de pago se recarga seguido (ir y volver de la app del banco) y nunca se
 * tiene que generar otro alias encima de una transferencia hecha.
 */
export async function POST(request: Request) {
  if (!(await isPaymentMethodAvailable("talo"))) {
    return NextResponse.json({ error: "Talo Pay no está disponible" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const ordenId = String(body.ordenId ?? "").trim();
  if (!ordenId) {
    return NextResponse.json({ error: "Orden requerida" }, { status: 400 });
  }

  let orden = await getOrden(ordenId);
  if (!orden) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  // Cerrada como vencida en Talo, pero quizás la plata llegó después: se consulta antes de decir que venció.
  if (orden.estado === "rechazado" && idsTaloDe(orden).length > 0) {
    await syncTaloPaymentForOrden(orden.id);
    orden = (await getOrden(ordenId)) ?? orden;
  }
  if (orden.estado === "aprobado" || orden.estado === "reembolsado") {
    return NextResponse.json({ tipo: "aprobada" });
  }
  if (orden.problema === "pago_sin_cupo") {
    return NextResponse.json({ tipo: "sin_cupo" });
  }
  if (orden.estado !== "pendiente") {
    return NextResponse.json({ error: MENSAJE_RESERVA_VENCIDA, vencida: true }, { status: 410 });
  }
  // Si ya tiene una transferencia iniciada se le vuelven a mostrar los datos; una nueva solo dentro de la reserva.
  if (idsTaloDe(orden).length === 0 && reservaVencida(orden)) {
    return NextResponse.json({ error: MENSAJE_RESERVA_VENCIDA, vencida: true }, { status: 410 });
  }

  const evento = await getEventoById(orden.eventoId);
  if (!evento) {
    return NextResponse.json({ error: "Fiesta no encontrada" }, { status: 400 });
  }

  const paso = await createTaloPaymentForOrden(orden, evento);
  if ("error" in paso) {
    return NextResponse.json(paso, { status: paso.vencida ? 410 : 502 });
  }
  if (paso.tipo === "aprobada" || paso.tipo === "sin_cupo") {
    return NextResponse.json({ tipo: paso.tipo });
  }

  // El alias se muestra recién cuando el pago quedó guardado en la compra: si no, no se podría
  // encontrar la transferencia después.
  const guardado = await setOrdenPaymentId(ordenId, paso.paymentId, "talo");
  if ("error" in guardado) {
    return NextResponse.json({ error: "No pudimos preparar la transferencia. Probá de nuevo en un momento." }, { status: 502 });
  }
  if (guardado.estado !== "pendiente") {
    return NextResponse.json({ error: "La compra cambió mientras tanto. Recargá la página." }, { status: 409 });
  }

  return NextResponse.json({
    tipo: paso.tipo,
    alias: paso.alias,
    cvu: paso.cvu,
    amount: paso.amount,
    status: paso.status,
    compradorEmail: orden.compradorEmail,
    montoTotal: orden.montoTotal,
    ...(paso.tipo === "incompleto" ? { recibido: paso.recibido } : {}),
  });
}
