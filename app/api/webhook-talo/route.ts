import { NextResponse } from "next/server";
import { getTaloClient } from "@/lib/talo/client";
import { processTaloPayment } from "@/lib/talo/payments";

export async function POST(request: Request) {
  let body: { paymentId?: string; externalId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const paymentId = body.paymentId?.trim();
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId requerido" }, { status: 400 });
  }

  const taloResult = await getTaloClient();
  if ("error" in taloResult) {
    console.error("[Talo webhook] sin credenciales:", taloResult.error);
    return NextResponse.json({ ok: true });
  }

  try {
    const payment = await taloResult.client.payments.get(paymentId);
    const result = await processTaloPayment(payment);
    if ("error" in result) {
      console.error("[Talo webhook] error procesando:", result.error);
    }
  } catch (error) {
    console.error("[Talo webhook] error consultando pago:", error);
  }

  return NextResponse.json({ ok: true });
}
