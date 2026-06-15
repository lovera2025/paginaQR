import { getAppUrl } from "@/lib/config";
import { getMpSettings, getMpWebhookUrl } from "@/lib/mercadopago/credentials";
import { mpFetch } from "@/lib/mercadopago/client";
import type { MpPreferenceResponse } from "@/lib/mercadopago/types";
import type { Evento, Orden } from "@/types";

export async function createCheckoutPreference(
  orden: Orden,
  evento: Evento
): Promise<{ initPoint: string } | { error: string }> {
  const appUrl = getAppUrl();
  const title = `Entrada — ${evento.nombre}`.slice(0, 256);
  const mp = await getMpSettings();

  const result = await mpFetch<MpPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: evento.id,
          title,
          quantity: orden.cantidad,
          unit_price: Number(evento.precio),
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

  const initPoint =
    mp.environment === "sandbox"
      ? result.data.sandbox_init_point || result.data.init_point
      : result.data.init_point || result.data.sandbox_init_point;

  if (!initPoint) return { error: "Mercado Pago no devolvió URL de pago" };

  return { initPoint };
}
