import { NextResponse } from "next/server";
import { createOrdenPendiente, getEventoActivo } from "@/lib/db";
import { canSimulatePayment } from "@/lib/config";
import { createCheckoutPreference } from "@/lib/mercadopago/preferences";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await createOrdenPendiente({
    compradorNombre: body.compradorNombre ?? "",
    compradorEmail: body.compradorEmail ?? "",
    cantidad: Number(body.cantidad) || 1,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (canSimulatePayment()) {
    return NextResponse.json({
      mode: "simulate",
      ordenId: result.orden.id,
      orden: result.orden,
    });
  }

  const evento = await getEventoActivo();
  if (!evento) {
    return NextResponse.json({ error: "No hay evento activo" }, { status: 400 });
  }

  const preference = await createCheckoutPreference(result.orden, evento);
  if ("error" in preference) {
    return NextResponse.json({ error: preference.error }, { status: 502 });
  }

  return NextResponse.json({
    mode: "mp",
    ordenId: result.orden.id,
    initPoint: preference.initPoint,
  });
}

export async function GET() {
  return NextResponse.json({ simulate: canSimulatePayment() });
}
