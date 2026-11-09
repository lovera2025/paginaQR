import { NextResponse } from "next/server";
import { createOrdenPendiente } from "@/lib/db";
import { getModoPagos } from "@/lib/payments/modo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const eventoId = String(body.eventoId ?? "").trim();
  const tipoEntradaId = String(body.tipoEntradaId ?? "").trim();
  if (!eventoId || !tipoEntradaId) {
    return NextResponse.json({ error: "Elegí la fiesta y el tipo de entrada" }, { status: 400 });
  }

  const modo = await getModoPagos();
  if (modo.sinMedios) {
    return NextResponse.json(
      { error: "Los pagos online no están disponibles en este momento. Escribinos por WhatsApp." },
      { status: 503 }
    );
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

  return NextResponse.json({
    mode: modo.simulate ? "simulate" : "choose",
    ordenId: result.orden.id,
    orden: result.orden,
    methods: modo.methods,
    sandbox: modo.sandbox,
  });
}

export async function GET() {
  const modo = await getModoPagos();
  return NextResponse.json({
    simulate: modo.simulate,
    sandbox: modo.sandbox,
    sinMedios: modo.sinMedios,
    methods: modo.methods,
  });
}
