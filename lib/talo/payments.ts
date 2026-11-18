import type { PaymentResponse } from "talo-pay";
import {
  approveOrden,
  getOrden,
  getOrdenByPaymentId,
  reabrirOrden,
  registrarActividad,
  rejectOrden,
  setMontoRecibido,
} from "@/lib/db";
import { getAppUrl } from "@/lib/config";
import { registrarPagoDoble, registrarPagoSinCupo } from "@/lib/payments/problemas";
import { MENSAJE_RESERVA_VENCIDA, reservaVencida } from "@/lib/payments/reserva";
import { formatPrecio } from "@/lib/utils";
import { getTaloClient, getTaloWebhookUrl } from "@/lib/talo/client";
import type { Evento, Orden } from "@/types";

export interface TaloTransferInstructions {
  paymentId: string;
  alias: string;
  cvu: string;
  amount: number;
  status: PaymentResponse["payment_status"];
}

/** La plata llegó (completa o de más). */
export function taloAcreditado(status: PaymentResponse["payment_status"] | undefined): boolean {
  return status === "SUCCESS" || status === "OVERPAID";
}

/** Plata que llegó a un pago de Talo (suma de las transferencias). */
export function recibidoTalo(payment: PaymentResponse): number {
  return (payment.transactions ?? []).reduce((total, t) => total + (Number(t.amount) || 0), 0);
}

/**
 * Parte del id de Talo que distingue un pago de otro. Los ids son "VAR-<cuenta>-<pago>": el
 * principio es igual para todos los pagos de la misma cuenta.
 */
export function idCortoTalo(paymentId: string): string {
  return paymentId.length > 12 ? `…${paymentId.slice(-8)}` : paymentId;
}

/** Pagos de Talo de una compra, del más nuevo al más viejo (sin los simulados). */
export function idsTaloDe(orden: Pick<Orden, "pagosTalo" | "paymentId" | "paymentMethod">): string[] {
  const ids = [...(orden.pagosTalo ?? [])];
  if (orden.paymentMethod === "talo" && orden.paymentId && !ids.includes(orden.paymentId)) ids.push(orden.paymentId);
  return ids.filter((id) => id && !id.startsWith("mock_")).reverse();
}

function splitNombre(nombre: string): { firstName: string; lastName: string } {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Comprador", lastName: "-" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function extractTransferInstructions(
  payment: PaymentResponse,
  fallbackAmount: number
): TaloTransferInstructions | { error: string } {
  const quote =
    payment.quotes?.find((q) => q.network === "transfer" || q.cvu || q.alias) ??
    payment.quotes?.[0];

  const alias = quote?.alias ?? payment.transaction_fields?.alias ?? "";
  const cvu = quote?.cvu ?? payment.transaction_fields?.cvu ?? "";

  if (!alias && !cvu) {
    return { error: "Talo no devolvió alias ni CVU para la transferencia" };
  }

  const rawAmount = quote?.amount ?? payment.transaction_fields?.amount ?? fallbackAmount;
  const amount = Number(rawAmount);

  return {
    paymentId: payment.id,
    alias,
    cvu,
    amount: Number.isFinite(amount) ? amount : fallbackAmount,
    status: payment.payment_status,
  };
}

export async function testTaloConnection(): Promise<
  { ok: true; environment: string } | { error: string }
> {
  const result = await getTaloClient();
  if ("error" in result) return result;

  const baseUrl =
    result.credentials.environment === "sandbox"
      ? "https://sandbox-api.talo.com.ar"
      : "https://api.talo.com.ar";

  try {
    const tokenRes = await fetch(
      `${baseUrl}/users/${encodeURIComponent(result.credentials.userId)}/tokens`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: result.credentials.clientId,
          client_secret: result.credentials.clientSecret,
        }),
      }
    );

    const tokenData = (await tokenRes.json()) as {
      error?: boolean;
      data?: { token?: string };
      message?: string;
    };

    if (!tokenRes.ok || tokenData.error || !tokenData.data?.token) {
      return {
        error:
          "No pudimos conectar con Talo. Revisá User ID, Client ID y Client Secret.",
      };
    }

    return { ok: true, environment: result.credentials.environment };
  } catch {
    return { error: "Error de red al conectar con Talo. Intentá de nuevo." };
  }
}

/** Qué mostrarle al comprador cuando quiere pagar por transferencia. */
export type PasoTalo =
  | ({ tipo: "transferir" } & TaloTransferInstructions)
  | { tipo: "aprobada" }
  | { tipo: "sin_cupo" }
  | ({ tipo: "incompleto"; recibido: number; total: number } & TaloTransferInstructions)
  | { error: string; vencida?: boolean };

/**
 * Datos para transferir. Antes de generar un pago nuevo revisa los que ya tiene la compra:
 * si alguno se pagó, se aprueba (nunca se genera otro alias encima de una transferencia hecha);
 * si llegó de menos, se avisa; si sigue esperando, se muestran los mismos datos.
 * Solo se genera uno nuevo si no había o si el anterior venció en Talo.
 */
export async function createTaloPaymentForOrden(orden: Orden, evento: Evento): Promise<PasoTalo> {
  const taloResult = await getTaloClient();
  if ("error" in taloResult) return taloResult;

  const { client } = taloResult;
  const ids = idsTaloDe(orden);
  let ultimo: PaymentResponse | null = null;
  for (const id of ids) {
    let existente: PaymentResponse;
    try {
      existente = await client.payments.get(id);
    } catch {
      // Sin saber si ya pagó no se genera otro alias: que pruebe de nuevo en un momento.
      return { error: "No pudimos consultar tu transferencia. Probá de nuevo en un momento." };
    }
    if (existente.external_id && existente.external_id !== orden.id) continue;
    if (taloAcreditado(existente.payment_status)) {
      const r = await processTaloPayment(existente);
      if ("error" in r) {
        return { error: "Tu transferencia llegó pero todavía no pudimos emitir las entradas. Probá de nuevo en un momento." };
      }
      const actual = await getOrden(orden.id);
      return actual?.problema === "pago_sin_cupo" && actual.estado !== "aprobado" ? { tipo: "sin_cupo" } : { tipo: "aprobada" };
    }
    if (!ultimo) ultimo = existente;
  }

  if (ultimo && ultimo.payment_status !== "EXPIRED") {
    const datos = extractTransferInstructions(ultimo, orden.montoTotal);
    if ("error" in datos) return datos;
    if (ultimo.payment_status === "UNDERPAID") {
      await processTaloPayment(ultimo);
      return { tipo: "incompleto", recibido: recibidoTalo(ultimo), total: orden.montoTotal, ...datos };
    }
    return { tipo: "transferir", ...datos };
  }

  // No hay pago vigente: uno nuevo solo dentro de la reserva.
  if (reservaVencida(orden)) return { error: MENSAJE_RESERVA_VENCIDA, vencida: true };

  const appUrl = getAppUrl();
  const { firstName, lastName } = splitNombre(orden.compradorNombre);
  const payment = await client.payments.create({
    user_id: taloResult.credentials.userId,
    price: { amount: Number(orden.montoTotal), currency: "ARS" },
    payment_options: ["transfer"],
    external_id: orden.id,
    webhook_url: getTaloWebhookUrl(),
    redirect_url: `${appUrl}/compra/exito?orden=${orden.id}`,
    motive: `${orden.cantidad} × ${orden.tipoNombre} — ${evento.nombre}`.slice(0, 256),
    client_data: {
      first_name: firstName,
      last_name: lastName,
      email: orden.compradorEmail,
    },
  });
  if (ultimo) {
    await registrarActividad(
      "pago",
      `Transferencia (Talo ${idCortoTalo(ultimo.id)}) · compra ${orden.id.slice(0, 8)} → venció en Talo: se generó otro alias (Talo ${idCortoTalo(payment.id)})`
    );
  }

  const datos = extractTransferInstructions(payment, orden.montoTotal);
  return "error" in datos ? datos : { tipo: "transferir", ...datos };
}

/** `reintentar` = falló algo momentáneo: el aviso responde error para que Talo lo reintente. */
export async function processTaloPayment(
  payment: PaymentResponse
): Promise<{ ok: true } | { error: string; reintentar?: boolean }> {
  const ordenId = payment.external_id?.trim();
  if (!ordenId) return { error: "Pago sin external_id" };

  const paymentId = payment.id;
  const existingByPayment = await getOrdenByPaymentId(paymentId);
  if (existingByPayment && existingByPayment.id !== ordenId) {
    console.warn("[Talo] payment id ya usado en otra orden:", paymentId);
    return { error: "Pago duplicado" };
  }

  const orden = await getOrden(ordenId);
  if (!orden) return { error: "Orden no encontrada" };

  const ref = `Transferencia (Talo ${idCortoTalo(paymentId)}) · compra ${ordenId.slice(0, 8)}`;
  const acreditada = taloAcreditado(payment.payment_status);

  if (orden.estado === "aprobado") {
    // Llegó plata a otro pago de una compra que ya estaba paga: hay que devolver uno.
    if (acreditada && orden.paymentId && orden.paymentId !== paymentId) {
      await registrarPagoDoble(orden, ref, recibidoTalo(payment) || orden.montoTotal);
    }
    return { ok: true };
  }

  // Transferencia de menos sobre una compra cerrada (vencida): se reabre para que se vea y se resuelva.
  if (orden.estado === "rechazado" && payment.payment_status === "UNDERPAID") {
    const reabierta = await reabrirOrden(ordenId);
    if ("error" in reabierta) return { error: reabierta.error, reintentar: true };
    return processTaloPayment(payment);
  }

  // La transferencia llegó después de que la compra se cerró (ej. vencida): se reabre para emitir
  // las entradas; si ya no hay lugar, queda marcada para devolver la plata.
  if (orden.estado === "rechazado" && acreditada) {
    const reabierta = await reabrirOrden(ordenId);
    if ("error" in reabierta) return { error: reabierta.error, reintentar: true };
    await registrarActividad("pago", `${ref} → la compra estaba rechazada y llegó la transferencia: se reabre`);
    return processTaloPayment(payment);
  }

  if (orden.estado !== "pendiente") {
    return { ok: true };
  }
  if (acreditada) {
    const result = await approveOrden(ordenId, paymentId, "talo");
    if ("error" in result) {
      if (result.sinCupo) {
        await registrarPagoSinCupo(orden, ref, result.error);
        return { ok: true };
      }
      await registrarActividad("pago", `${ref} → transferencia acreditada pero no se pudieron emitir las entradas: ${result.error}`);
      return { error: result.error, reintentar: true };
    }
    await registrarActividad("pago", `${ref} → aprobado${result.orden.modoPago === "sandbox" ? " (PRUEBA)" : ""}`);
    return { ok: true };
  }

  if (payment.payment_status === "UNDERPAID") {
    const recibido = recibidoTalo(payment);
    if (orden.montoRecibido !== recibido) {
      await setMontoRecibido(ordenId, recibido);
      await registrarActividad(
        "pago",
        `${ref} → TRANSFIRIÓ DE MENOS: llegaron ${formatPrecio(recibido)} de ${formatPrecio(orden.montoTotal)}. No se emitieron entradas.`
      );
    }
    return { ok: true };
  }

  if (payment.payment_status === "EXPIRED") {
    // Venció un alias viejo pero la compra ya tiene otro pago más nuevo: no se cierra.
    if (orden.paymentMethod === "talo" && orden.paymentId && orden.paymentId !== paymentId) {
      return { ok: true };
    }
    const result = await rejectOrden(ordenId);
    if ("error" in result) return { error: result.error, reintentar: true };
    await registrarActividad("pago", `${ref} → venció sin pagar`);
    return { ok: true };
  }

  return { ok: true };
}

/**
 * Consulta en Talo todos los pagos de la compra (no solo el último) y aplica lo que corresponda.
 * `status` y `recibido` son los del pago que decidió el resultado.
 */
export async function syncTaloPaymentForOrden(
  ordenId: string
): Promise<{ ok: true; status?: PaymentResponse["payment_status"]; recibido?: number } | { error: string }> {
  const taloResult = await getTaloClient();
  if ("error" in taloResult) return taloResult;

  const orden = await getOrden(ordenId);
  if (!orden) return { error: "Orden no encontrada" };

  const ids = idsTaloDe(orden);
  if (ids.length === 0) return { ok: true };

  let masNuevo: PaymentResponse | null = null;
  let falla: string | null = null;
  for (const id of ids) {
    let payment: PaymentResponse;
    try {
      payment = await taloResult.client.payments.get(id);
    } catch (error) {
      falla = error instanceof Error ? error.message : "Error al consultar Talo";
      continue;
    }
    if (payment.external_id && payment.external_id !== ordenId) continue;
    if (taloAcreditado(payment.payment_status)) {
      const result = await processTaloPayment(payment);
      if ("error" in result) return result;
      return { ok: true, status: payment.payment_status };
    }
    if (!masNuevo) masNuevo = payment;
  }

  if (!masNuevo) return falla ? { error: falla } : { ok: true };
  const result = await processTaloPayment(masNuevo);
  if ("error" in result) return result;
  return {
    ok: true,
    status: masNuevo.payment_status,
    ...(masNuevo.payment_status === "UNDERPAID" ? { recibido: recibidoTalo(masNuevo) } : {}),
  };
}
