import { NextResponse } from "next/server";
import { approveOrden, getOrden } from "@/lib/db";
import { registrarPagoSinCupo } from "@/lib/payments/problemas";
import { canSimulatePayment } from "@/lib/talo/credentials";

export async function POST(request: Request) {
  if (!(await canSimulatePayment())) {
    return NextResponse.json({ error: "Simulación no disponible" }, { status: 403 });
  }

  const { ordenId } = await request.json();
  if (!ordenId) {
    return NextResponse.json({ error: "ordenId requerido" }, { status: 400 });
  }

  const result = await approveOrden(ordenId);
  if ("error" in result) {
    // Igual que con un pago real: si se agotaron mientras pagaba, la compra queda para devolver.
    const orden = result.sinCupo ? await getOrden(ordenId) : null;
    if (orden) {
      await registrarPagoSinCupo(orden, `Pago simulado · compra ${ordenId.slice(0, 8)}`, result.error);
      return NextResponse.json({ orden: await getOrden(ordenId), sinCupo: true });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    orden: result.orden,
    ticketIds: result.tickets.map((t) => t.id),
  });
}
