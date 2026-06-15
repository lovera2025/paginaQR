import { NextResponse } from "next/server";
import { getEventoActivo, getOrden } from "@/lib/db";
import { canSimulatePayment } from "@/lib/config";
import { createCheckoutPreference } from "@/lib/mercadopago/preferences";

export async function POST(request: Request) {
  if (canSimulatePayment()) {
    return NextResponse.json({ error: "Mercado Pago no configurado" }, { status: 400 });
  }

  const { ordenId } = await request.json();
  if (!ordenId) {
    return NextResponse.json({ error: "ordenId requerido" }, { status: 400 });
  }

  const orden = await getOrden(ordenId);
  if (!orden) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  if (orden.estado !== "pendiente") {
    return NextResponse.json({ error: "La orden ya fue procesada" }, { status: 400 });
  }

  const evento = await getEventoActivo();
  if (!evento) {
    return NextResponse.json({ error: "No hay evento activo" }, { status: 400 });
  }

  const preference = await createCheckoutPreference(orden, evento);
  if ("error" in preference) {
    return NextResponse.json({ error: preference.error }, { status: 502 });
  }

  return NextResponse.json({ initPoint: preference.initPoint });
}
