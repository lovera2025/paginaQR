import { NextResponse } from "next/server";
import { syncTaloPaymentForOrden } from "@/lib/talo/payments";

export async function POST(request: Request) {
  const body = await request.json();
  const ordenId = String(body.ordenId ?? "").trim();
  const paymentId = body.paymentId ? String(body.paymentId) : undefined;

  if (!ordenId) {
    return NextResponse.json({ error: "Orden requerida" }, { status: 400 });
  }

  const result = await syncTaloPaymentForOrden(ordenId, paymentId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status: result.status ?? null });
}
