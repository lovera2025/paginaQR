import { NextResponse } from "next/server";
import { createOrdenPendiente } from "@/lib/db";
import { canSimulatePayment, getEnabledPaymentMethods } from "@/lib/payments/methods";

export async function POST(request: Request) {
  const body = await request.json();
  const eventoId = String(body.eventoId ?? "").trim();
  const tipoEntradaId = String(body.tipoEntradaId ?? "").trim();
  if (!eventoId || !tipoEntradaId) {
    return NextResponse.json({ error: "Elegí la fiesta y el tipo de entrada" }, { status: 400 });
  }

  const result = await createOrdenPendiente({
    eventoId,
    tipoEntradaId,
    compradorNombre: String(body.compradorNombre ?? ""),
    compradorEmail: String(body.compradorEmail ?? ""),
    cantidad: Number(body.cantidad) || 1,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (await canSimulatePayment()) {
    return NextResponse.json({ mode: "simulate", ordenId: result.orden.id, orden: result.orden });
  }

  return NextResponse.json({
    mode: "choose",
    ordenId: result.orden.id,
    orden: result.orden,
    methods: await getEnabledPaymentMethods(),
  });
}

export async function GET() {
  return NextResponse.json({
    simulate: await canSimulatePayment(),
    methods: await getEnabledPaymentMethods(),
  });
}
