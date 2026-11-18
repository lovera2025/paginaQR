import { getOrden } from "@/lib/db";
import { isMercadoPagoConfigured } from "@/lib/mercadopago/credentials";
import { syncMpPaymentForOrden } from "@/lib/mercadopago/payments";
import { getTaloClient } from "@/lib/talo/client";
import { idsTaloDe, syncTaloPaymentForOrden } from "@/lib/talo/payments";
import type { Orden } from "@/types";

export interface RevisionPago {
  orden: Orden;
  /** Cambió el estado (por ejemplo, estaba paga y se emitieron las entradas). */
  cambio: boolean;
  error: string | null;
}

/**
 * Pregunta en Talo o Mercado Pago si una compra sin pagar en realidad se pagó, y si es así emite
 * las entradas (o la marca para devolver si ya no hay lugar). Lo usan "Revisar pago" del panel,
 * "Revisar todas" y "Recuperar mis entradas". Alcanza con que las credenciales estén cargadas:
 * aunque el medio se haya pausado, las transferencias ya iniciadas se siguen pudiendo confirmar.
 */
export async function revisarPago(orden: Orden): Promise<RevisionPago> {
  if (orden.estado !== "pendiente" && orden.estado !== "rechazado") {
    return { orden, cambio: false, error: null };
  }

  let error: string | null = null;
  if (idsTaloDe(orden).length > 0) {
    if (!("error" in (await getTaloClient()))) {
      const r = await syncTaloPaymentForOrden(orden.id);
      if ("error" in r) error = `Talo: ${r.error}`;
    } else {
      error = "Talo no está configurado";
    }
  } else if (orden.paymentMethod !== "talo" && (await isMercadoPagoConfigured())) {
    const r = await syncMpPaymentForOrden(orden.id);
    if ("error" in r) error = `Mercado Pago: ${r.error}`;
  }

  const actual = (await getOrden(orden.id)) ?? orden;
  return {
    orden: actual,
    cambio:
      actual.estado !== orden.estado ||
      actual.problema !== orden.problema ||
      (actual.montoRecibido ?? null) !== (orden.montoRecibido ?? null),
    error,
  };
}
