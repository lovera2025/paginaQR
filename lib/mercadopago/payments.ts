import {
  approveOrden,
  getOrden,
  getOrdenByPaymentId,
  reabrirOrden,
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

/**
 * `reintentar` = falló algo momentáneo (base, red): el aviso tiene que responder error
 * para que Mercado Pago lo vuelva a mandar. Los demás errores son definitivos.
 */
export type ResultadoPago = { ok: true } | { error: string; reintentar?: boolean };

export async function processMpPayment(payment: MpPayment): Promise<ResultadoPago> {
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
  // Con cuentas de prueba (vendedor y comprador de prueba) MP devuelve live_mode = true: solo
  // live_mode = false asegura que es de prueba; si no, decide el ambiente cargado en Admin → Pagos.
  const modo = payment.live_mode === false ? "sandbox" : undefined;
  const ref = `Mercado Pago (pago ${mpPaymentId}) · compra ${ordenId.slice(0, 8)}`;

  if (orden.estado === "aprobado") {
    await approveOrden(ordenId, mpPaymentId, "mp", modo);
    return { ok: true };
  }

  // Compra cerrada como rechazada (ej. vencida, o un intento anterior rechazado) pero ahora llega
  // un pago aprobado: se reabre para emitir las entradas. Si ya no hay lugar, queda para devolver.
  if (orden.estado === "rechazado" && payment.status === "approved") {
    const reabierta = await reabrirOrden(ordenId);
    if ("error" in reabierta) return { error: reabierta.error, reintentar: true };
    await registrarActividad("pago", `${ref} → la compra estaba rechazada y llegó un pago aprobado: se reabre`);
    return processMpPayment(payment);
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
      return { error: result.error, reintentar: true };
    }
    // Si dos avisos llegan juntos (aviso de MP + pantalla de éxito), se anota una sola vez.
    if (result.nueva) {
      await registrarActividad("pago", `${ref} → aprobado${result.orden.modoPago === "sandbox" ? " (PRUEBA)" : ""}`);
    }
    return { ok: true };
  }

  if (payment.status === "rejected") {
    // Una tarjeta rechazada no cierra la compra: en el checkout de Mercado Pago la persona
    // puede probar con otra tarjeta. La reserva sigue hasta que vence.
    await registrarActividad("pago", `${ref} → intento rechazado (puede probar con otro medio)`);
    return { ok: true };
  }

  if (payment.status === "cancelled") {
    const result = await rejectOrden(ordenId);
    if ("error" in result) return { error: result.error, reintentar: true };
    await registrarActividad("pago", `${ref} → cancelado`);
    return { ok: true };
  }

  return { ok: true };
}

export async function processMpPaymentNotification(paymentId: string): Promise<ResultadoPago> {
  const payment = await getMpPayment(paymentId);
  if ("error" in payment) return { error: payment.error, reintentar: true };
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
