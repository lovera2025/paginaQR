import {
  approveOrden,
  getOrden,
  getOrdenByPaymentId,
  registrarActividad,
  rejectOrden,
} from "@/lib/db";
import { mpFetch } from "@/lib/mercadopago/client";
import { registrarPagoSinCupo } from "@/lib/payments/problemas";
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

  const existingByMp = await getOrdenByPaymentId(mpPaymentId);
  if (existingByMp && existingByMp.id !== ordenId) {
    console.warn("[MP] payment id ya usado en otra orden:", mpPaymentId);
    return { error: "Pago duplicado" };
  }

  const orden = await getOrden(ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  const modo = payment.live_mode === false ? "sandbox" : payment.live_mode === true ? "produccion" : undefined;
  const ref = `MP ${mpPaymentId} · compra ${ordenId.slice(0, 8)}`;

  if (orden.estado === "aprobado") {
    await approveOrden(ordenId, mpPaymentId, "mp", modo);
    return { ok: true };
  }

  if (orden.estado !== "pendiente") {
    return { ok: true };
  }

  if (payment.status === "approved") {
    const pagado = Number(payment.transaction_amount ?? orden.montoTotal);
    if (pagado + 0.5 < orden.montoTotal) {
      await registrarActividad("pago", `${ref} → monto menor al de la compra ($${pagado} de $${orden.montoTotal}), no se aprobó`);
      return { error: "El monto pagado no coincide con la compra" };
    }
    const result = await approveOrden(ordenId, mpPaymentId, "mp", modo);
    if ("error" in result) {
      if (result.sinCupo) {
        // Ya está resuelto del lado nuestro (queda para devolver): no hace falta que MP reintente.
        await registrarPagoSinCupo(orden, ref, result.error);
        return { ok: true };
      }
      await registrarActividad("pago", `${ref} → pago aprobado pero no se pudieron emitir las entradas: ${result.error}`);
      return { error: result.error };
    }
    await registrarActividad("pago", `${ref} → aprobado${modo === "sandbox" ? " (PRUEBA)" : ""}`);
    return { ok: true };
  }

  if (payment.status === "rejected" || payment.status === "cancelled") {
    const result = await rejectOrden(ordenId);
    if ("error" in result) return { error: result.error };
    await registrarActividad("pago", `${ref} → ${payment.status === "rejected" ? "rechazado" : "cancelado"}`);
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
