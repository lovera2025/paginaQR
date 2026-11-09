import type { PaymentResponse } from "talo-pay";
import {
  approveOrden,
  getOrden,
  getOrdenByPaymentId,
  reabrirOrden,
  registrarActividad,
  rejectOrden,
} from "@/lib/db";
import { getAppUrl } from "@/lib/config";
import { registrarPagoSinCupo } from "@/lib/payments/problemas";
import { getTaloClient, getTaloWebhookUrl } from "@/lib/talo/client";
import type { Evento, Orden } from "@/types";

export interface TaloTransferInstructions {
  paymentId: string;
  alias: string;
  cvu: string;
  amount: number;
  status: PaymentResponse["payment_status"];
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

export async function createTaloPaymentForOrden(
  orden: Orden,
  evento: Evento
): Promise<TaloTransferInstructions | { error: string }> {
  const taloResult = await getTaloClient();
  if ("error" in taloResult) return taloResult;

  const { client } = taloResult;
  const appUrl = getAppUrl();
  const { firstName, lastName } = splitNombre(orden.compradorNombre);

  if (orden.paymentId && !orden.paymentId.startsWith("mock_")) {
    try {
      const existing = await client.payments.get(orden.paymentId);
      if (existing.payment_status === "PENDING") {
        return extractTransferInstructions(existing, orden.montoTotal);
      }
    } catch {
      // Si falla, creamos un pago nuevo abajo.
    }
  }

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

  return extractTransferInstructions(payment, orden.montoTotal);
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

  if (orden.estado === "aprobado") {
    await approveOrden(ordenId, paymentId, "talo");
    return { ok: true };
  }

  const ref = `Talo ${paymentId.slice(0, 12)} · compra ${ordenId.slice(0, 8)}`;
  const acreditada = payment.payment_status === "SUCCESS" || payment.payment_status === "OVERPAID";

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

  if (payment.payment_status === "EXPIRED") {
    const result = await rejectOrden(ordenId);
    if ("error" in result) return { error: result.error, reintentar: true };
    await registrarActividad("pago", `${ref} → venció sin pagar`);
    return { ok: true };
  }

  return { ok: true };
}

export async function syncTaloPaymentForOrden(
  ordenId: string,
  paymentId?: string
): Promise<{ ok: true; status?: PaymentResponse["payment_status"] } | { error: string }> {
  const taloResult = await getTaloClient();
  if ("error" in taloResult) return taloResult;

  const orden = await getOrden(ordenId);
  if (!orden) return { error: "Orden no encontrada" };

  const resolvedPaymentId = paymentId ?? orden.paymentId ?? undefined;
  if (!resolvedPaymentId || resolvedPaymentId.startsWith("mock_")) {
    return { ok: true };
  }

  try {
    const payment = await taloResult.client.payments.get(resolvedPaymentId);
    if (payment.external_id && payment.external_id !== ordenId) {
      return { error: "El pago no corresponde a esta orden" };
    }
    const result = await processTaloPayment(payment);
    if ("error" in result) return result;
    return { ok: true, status: payment.payment_status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al consultar Talo";
    return { error: message };
  }
}
