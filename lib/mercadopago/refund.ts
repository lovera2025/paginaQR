import { mpFetch } from "@/lib/mercadopago/client";

export async function refundMpPayment(
  mpPaymentId: string
): Promise<{ ok: true } | { error: string }> {
  const result = await mpFetch<{ id: number }>(
    `/v1/payments/${mpPaymentId}/refunds`,
    { method: "POST", body: JSON.stringify({}) }
  );

  if ("error" in result) {
    return { error: "No se pudo reembolsar en Mercado Pago" };
  }

  return { ok: true };
}

export function isMpPaymentId(paymentId: string | null): boolean {
  return Boolean(paymentId && /^\d+$/.test(paymentId));
}
