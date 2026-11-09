import { getAppUrl } from "@/lib/config";
import { getMpWebhookUrl } from "@/lib/mercadopago/credentials";
import { mpFetch } from "@/lib/mercadopago/client";
import type { MpPreferenceResponse } from "@/lib/mercadopago/types";
import type { Evento, Orden } from "@/types";

export async function createCheckoutPreference(
  orden: Orden,
  evento: Evento
): Promise<{ initPoint: string } | { error: string }> {
  const appUrl = getAppUrl();
  const title = `Entrada ${orden.tipoNombre} — ${evento.nombre}`.slice(0, 256);

  const result = await mpFetch<MpPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: orden.tipoEntradaId ?? evento.id,
          title,
          quantity: orden.cantidad,
          // Precio congelado al crear la orden (si el admin lo cambia después, no afecta).
          unit_price: Number(orden.precioUnitario),
          currency_id: "ARS",
        },
      ],
      payer: {
        name: orden.compradorNombre,
        email: orden.compradorEmail,
      },
      external_reference: orden.id,
      back_urls: {
        success: `${appUrl}/compra/exito?orden=${orden.id}&metodo=mp`,
        failure: `${appUrl}/compra/error?orden=${orden.id}`,
        pending: `${appUrl}/compra/exito?orden=${orden.id}&metodo=mp`,
      },
      auto_return: "approved",
      notification_url: getMpWebhookUrl(),
    }),
  });

  if ("error" in result) return { error: result.error };

  // Con credenciales de prueba, init_point ya abre el checkout de prueba (sandbox_init_point está deprecado).
  const initPoint = result.data.init_point || result.data.sandbox_init_point;

  if (!initPoint) return { error: "Mercado Pago no devolvió URL de pago" };

  return { initPoint };
}
