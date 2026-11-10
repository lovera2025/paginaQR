import { NextResponse } from "next/server";
import { createOrdenPendiente } from "@/lib/db";
import { crearLimite, ipDe } from "@/lib/limite";
import { getModoPagos } from "@/lib/payments/modo";

export const dynamic = "force-dynamic";

// Cada compra sin pagar guarda entradas unos minutos: se limita cuántas se pueden iniciar por IP.
// Generoso porque en datos móviles mucha gente comparte la misma IP.
const compras = crearLimite("checkout", 15, 10 * 60 * 1000);

export async function POST(request: Request) {
  const ip = ipDe(request);
  if (compras.bloqueado(ip)) {
    return NextResponse.json(
      { error: "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo." },
      { status: 429 }
    );
  }
  compras.sumar(ip);

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
