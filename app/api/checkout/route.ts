import { NextResponse } from "next/server";
import { createOrdenPendiente } from "@/lib/db";
import { canSimulatePayment, getEnabledPaymentMethods } from "@/lib/payments/methods";

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

  if (await canSimulatePayment()) {
    return NextResponse.json({
      mode: "simulate",
      ordenId: result.orden.id,
      orden: result.orden,
    });
  }

  const methods = await getEnabledPaymentMethods();

  return NextResponse.json({
    mode: "choose",
    ordenId: result.orden.id,
    orden: result.orden,
    methods,
  });
}

export async function GET() {
  const methods = await getEnabledPaymentMethods();
  return NextResponse.json({
    simulate: await canSimulatePayment(),
    methods,
  });
}
