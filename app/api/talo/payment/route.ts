import { NextResponse } from "next/server";
import { getEventoActivo, getOrden, setOrdenPaymentId } from "@/lib/db";
import { createTaloPaymentForOrden } from "@/lib/talo/payments";

export async function POST(request: Request) {
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

  const evento = await getEventoActivo();
  if (!evento) {
    return NextResponse.json({ error: "No hay evento activo" }, { status: 400 });
  }

  const payment = await createTaloPaymentForOrden(orden, evento);
  if ("error" in payment) {
    return NextResponse.json({ error: payment.error }, { status: 502 });
  }

  await setOrdenPaymentId(ordenId, payment.paymentId);

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
