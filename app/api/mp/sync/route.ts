import { NextResponse } from "next/server";
import { getOrden } from "@/lib/db";
import { canSimulatePayment } from "@/lib/config";
import { syncMpPaymentForOrden } from "@/lib/mercadopago/payments";

export async function POST(request: Request) {
  const body = await request.json();
  const ordenId = body.ordenId as string | undefined;
  const paymentId =
    (body.paymentId as string | undefined) ||
    (body.collectionId as string | undefined);

  if (!ordenId) {
    return NextResponse.json({ error: "ordenId requerido" }, { status: 400 });
  }

  const ordenBefore = await getOrden(ordenId);
  if (!ordenBefore) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  if (!canSimulatePayment()) {
    const syncResult = await syncMpPaymentForOrden(ordenId, paymentId);
    if ("error" in syncResult) {
      return NextResponse.json({ error: syncResult.error }, { status: 400 });
    }
  }

  const orden = await getOrden(ordenId);
  return NextResponse.json({ orden });
}
