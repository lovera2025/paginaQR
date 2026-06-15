import {
  approveOrden,
  getOrden,
  getOrdenByMpPaymentId,
  rejectOrden,
} from "@/lib/db";
import { mpFetch } from "@/lib/mercadopago/client";
import type { MpPayment, MpPaymentSearchResponse } from "@/lib/mercadopago/types";

export async function getMpPayment(
  paymentId: string
): Promise<MpPayment | { error: string }> {
  const result = await mpFetch<MpPayment>(`/v1/payments/${paymentId}`);
  if ("error" in result) return { error: result.error };
  return result.data;
}

export async function searchMpPaymentsByOrden(
  ordenId: string
): Promise<MpPayment[]> {
  const result = await mpFetch<MpPaymentSearchResponse>(
    `/v1/payments/search?external_reference=${encodeURIComponent(ordenId)}&sort=date_created&criteria=desc`
  );
  if ("error" in result) return [];
  return result.data.results ?? [];
}

export async function processMpPayment(
  payment: MpPayment
): Promise<{ ok: true } | { error: string }> {
  const ordenId = payment.external_reference?.trim();
  if (!ordenId) return { error: "Pago sin external_reference" };

  const mpPaymentId = String(payment.id);

  const existingByMp = await getOrdenByMpPaymentId(mpPaymentId);
  if (existingByMp && existingByMp.id !== ordenId) {
    console.warn("[MP] payment id ya usado en otra orden:", mpPaymentId);
    return { error: "Pago duplicado" };
  }

  const orden = await getOrden(ordenId);
  if (!orden) return { error: "Orden no encontrada" };

  if (orden.estado === "aprobado") {
    if (orden.mpPaymentId === mpPaymentId || !orden.mpPaymentId) {
      await approveOrden(ordenId, mpPaymentId);
    }
    return { ok: true };
  }

  if (orden.estado !== "pendiente") {
    return { ok: true };
  }

  if (payment.status === "approved") {
    const result = await approveOrden(ordenId, mpPaymentId);
    if ("error" in result) return { error: result.error };
    return { ok: true };
  }

  if (payment.status === "rejected" || payment.status === "cancelled") {
    const result = await rejectOrden(ordenId);
    if ("error" in result) return { error: result.error };
    return { ok: true };
  }

  return { ok: true };
}

export async function processMpPaymentNotification(
  paymentId: string
): Promise<{ ok: true } | { error: string }> {
  const payment = await getMpPayment(paymentId);
  if ("error" in payment) return { error: payment.error };
  return processMpPayment(payment);
}

export async function syncMpPaymentForOrden(
  ordenId: string,
  paymentId?: string
): Promise<{ ok: true } | { error: string }> {
  if (paymentId) {
    const payment = await getMpPayment(paymentId);
    if ("error" in payment) return { error: payment.error };
    if (payment.external_reference && payment.external_reference !== ordenId) {
      return { error: "El pago no corresponde a esta orden" };
    }
    return processMpPayment(payment);
  }

  const payments = await searchMpPaymentsByOrden(ordenId);
  for (const payment of payments) {
    if (payment.status === "approved") {
      return processMpPayment(payment);
    }
  }

  return { ok: true };
}
