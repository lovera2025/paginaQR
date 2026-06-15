import { NextResponse } from "next/server";
import { isMercadoPagoConfigured } from "@/lib/mercadopago/credentials";
import { processMpPaymentNotification } from "@/lib/mercadopago/payments";

async function handleNotification(paymentId: string) {
  if (!(await isMercadoPagoConfigured())) return;
  try {
    await processMpPaymentNotification(paymentId);
  } catch (err) {
    console.error("[MP webhook] error procesando pago", paymentId, err);
  }
}

export async function POST(request: Request) {
  if (!(await isMercadoPagoConfigured())) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json().catch(() => null);
  if (body?.type === "payment" && body?.data?.id != null) {
    await handleNotification(String(body.data.id));
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  if (!(await isMercadoPagoConfigured())) {
    return NextResponse.json({ ok: true });
  }

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic") ?? searchParams.get("type");
  const id = searchParams.get("id") ?? searchParams.get("data.id");

  if (topic === "payment" && id) {
    await handleNotification(id);
  }

  return NextResponse.json({ ok: true });
}
