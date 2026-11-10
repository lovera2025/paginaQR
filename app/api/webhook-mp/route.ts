import { NextResponse } from "next/server";
import { isMercadoPagoConfigured } from "@/lib/mercadopago/credentials";
import { processMpPaymentNotification } from "@/lib/mercadopago/payments";

/**
 * Procesa el aviso. Si falla algo momentáneo (base caída, MP no responde) responde 500:
 * así Mercado Pago lo reintenta y la compra no queda cobrada sin entradas.
 */
async function handleNotification(paymentId: string): Promise<NextResponse> {
  try {
    const result = await processMpPaymentNotification(paymentId);
    if ("error" in result && result.reintentar) {
      console.error("[MP webhook] no se pudo procesar, MP va a reintentar:", paymentId, result.error);
      return NextResponse.json({ error: "Reintentar" }, { status: 500 });
    }
  } catch (err) {
    console.error("[MP webhook] error procesando pago", paymentId, err);
    return NextResponse.json({ error: "Reintentar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!(await isMercadoPagoConfigured())) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json().catch(() => null);
  if (body?.type === "payment" && body?.data?.id != null) {
    return handleNotification(String(body.data.id));
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
    return handleNotification(id);
  }

  return NextResponse.json({ ok: true });
}
