import { NextResponse } from "next/server";
import { getEventoById, getOrden, setOrdenPaymentId } from "@/lib/db";
import { createTaloPaymentForOrden } from "@/lib/talo/payments";

import { isPaymentMethodAvailable } from "@/lib/payments/methods";
import { MENSAJE_RESERVA_VENCIDA, reservaVencida } from "@/lib/payments/reserva";

export async function POST(request: Request) {
  if (!(await isPaymentMethodAvailable("talo"))) {
    return NextResponse.json({ error: "Talo Pay no está disponible" }, { status: 400 });
  }
  const body = await request.json();
  const ordenId = String(body.ordenId ?? "").trim();
  if (!ordenId) {
    return NextResponse.json({ error: "Orden requerida" }, { status: 400 });
  }

  const orden = await getOrden(ordenId);
  if (!orden) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  if (orden.estado !== "pendiente") {
    return NextResponse.json({ error: "Esta orden ya fue procesada" }, { status: 400 });
  }
  // Si ya tiene una transferencia iniciada se le vuelven a mostrar los datos; una nueva solo dentro de la reserva.
  if (!orden.paymentId && reservaVencida(orden)) {
    return NextResponse.json({ error: MENSAJE_RESERVA_VENCIDA, vencida: true }, { status: 410 });
  }

  const evento = await getEventoById(orden.eventoId);
  if (!evento) {
    return NextResponse.json({ error: "Fiesta no encontrada" }, { status: 400 });
  }

  const payment = await createTaloPaymentForOrden(orden, evento);
  if ("error" in payment) {
    return NextResponse.json({ error: payment.error }, { status: 502 });
  }

  await setOrdenPaymentId(ordenId, payment.paymentId, "talo");

  return NextResponse.json({
    paymentId: payment.paymentId,
    alias: payment.alias,
    cvu: payment.cvu,
    amount: payment.amount,
    status: payment.status,
    compradorEmail: orden.compradorEmail,
    montoTotal: orden.montoTotal,
  });
}
