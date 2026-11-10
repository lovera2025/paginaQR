import { getAppUrl } from "@/lib/config";
import { linkPagoVenceEl } from "@/lib/entradas/tipos";
import { getMpSettings, getMpWebhookUrl } from "@/lib/mercadopago/credentials";
import { mpFetch } from "@/lib/mercadopago/client";
import type { MpPreferenceResponse } from "@/lib/mercadopago/types";
import type { Evento, Orden } from "@/types";

/** Fecha con la hora de Argentina (UTC-3, sin horario de verano), formato que pide Mercado Pago. */
export function isoArgentina(d: Date): string {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().replace("Z", "-03:00");
}

/** La web corre en la PC (pruebas locales): Mercado Pago no puede llegar a esa dirección. */
export function esUrlLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/** Arma el pedido de la preferencia (separado para poder testearlo). */
export function preferenciaBody(
  orden: Orden,
  evento: Evento,
  appUrl: string,
  webhookUrl: string,
  now: Date = new Date(),
  { prueba = false }: { prueba?: boolean } = {}
) {
  const title = `Entrada ${orden.tipoNombre} — ${evento.nombre}`.slice(0, 256);
  // En pruebas locales MP rechaza la vuelta automática y el aviso a localhost: se vuelve con
  // "Volver al sitio" y la pantalla de éxito consulta el pago (no hace falta el aviso).
  const local = esUrlLocal(appUrl);
  return {
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
    // Con el token de prueba no se manda el mail del comprador: si es de una cuenta real de MP,
    // el checkout falla con "Una de las partes con la que intentás hacer el pago es de prueba".
    ...(prueba ? {} : { payer: { name: orden.compradorNombre, email: orden.compradorEmail } }),
    external_reference: orden.id,
    back_urls: {
      success: `${appUrl}/compra/exito?orden=${orden.id}&metodo=mp`,
      failure: `${appUrl}/compra/error?orden=${orden.id}`,
      pending: `${appUrl}/compra/exito?orden=${orden.id}&metodo=mp`,
    },
    ...(local ? {} : { auto_return: "approved", notification_url: webhookUrl }),
    // Las entradas quedan guardadas unos minutos: el link vence antes que la reserva,
    // así nadie paga una entrada que ya se liberó.
    expires: true,
    expiration_date_from: isoArgentina(now),
    expiration_date_to: isoArgentina(linkPagoVenceEl(orden)),
    // Aprobado o rechazado en el momento: nada de pagos "en proceso" ni efectivo que se acredita días después.
    binary_mode: true,
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
  };
}

export async function createCheckoutPreference(
  orden: Orden,
  evento: Evento
): Promise<{ initPoint: string } | { error: string }> {
  const appUrl = getAppUrl();
  const mp = await getMpSettings();

  const result = await mpFetch<MpPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(
      preferenciaBody(orden, evento, appUrl, getMpWebhookUrl(), new Date(), { prueba: mp.environment === "sandbox" })
    ),
  });

  if ("error" in result) return { error: result.error };

  // Con credenciales de prueba, init_point ya abre el checkout de prueba (sandbox_init_point está deprecado).
  const initPoint = result.data.init_point || result.data.sandbox_init_point;

  if (!initPoint) return { error: "Mercado Pago no devolvió URL de pago" };

  return { initPoint };
}
