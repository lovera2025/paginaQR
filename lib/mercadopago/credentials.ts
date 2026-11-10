import { getAppUrl } from "@/lib/config";
import {
  getPaymentSettings,
  isMpConfigured,
  savePaymentSettingsRow,
  type MpSettings,
  type PaymentEnvironment,
} from "@/lib/payments/settings";

export interface SaveMpCredentialsInput {
  accessToken?: string;
  /** "auto" = lo decide la clave: si es de una cuenta de prueba queda en prueba, si no en cobros reales. */
  environment: PaymentEnvironment | "auto";
  enabled: boolean;
}

export type TipoClaveMp = "prueba" | "produccion" | "desconocido";

/**
 * Le pregunta a Mercado Pago de qué cuenta es la clave. Los usuarios de prueba vienen con el
 * tag "test_user" y las claves de prueba viejas empiezan con TEST-.
 */
export async function detectarTipoClave(
  accessToken: string
): Promise<{ tipo: TipoClaveMp } | { error: string }> {
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return { error: "Mercado Pago no reconoce esa clave. Copiala de nuevo completa (empieza con APP_USR-)." };
    }
    const me = (await res.json().catch(() => ({}))) as { tags?: string[] };
    const tags = Array.isArray(me.tags) ? me.tags : [];
    if (tags.includes("test_user") || accessToken.startsWith("TEST-")) return { tipo: "prueba" };
    return { tipo: accessToken.startsWith("APP_USR-") ? "produccion" : "desconocido" };
  } catch {
    return { error: "No pudimos comunicarnos con Mercado Pago. Probá de nuevo en un momento." };
  }
}

export async function getMpSettings(): Promise<MpSettings> {
  const settings = await getPaymentSettings();
  return settings.mp;
}

export async function isMercadoPagoConfigured(): Promise<boolean> {
  const mp = await getMpSettings();
  return isMpConfigured(mp);
}

export async function isMercadoPagoEnabled(): Promise<boolean> {
  const settings = await getPaymentSettings();
  return settings.mp.enabled && isMpConfigured(settings.mp);
}

export function getMpWebhookUrl(): string {
  return `${getAppUrl()}/api/webhook-mp`;
}

export async function saveMpCredentials(
  input: SaveMpCredentialsInput
): Promise<{ ok: true; environment: PaymentEnvironment } | { error: string }> {
  if (input.environment !== "sandbox" && input.environment !== "production" && input.environment !== "auto") {
    return { error: "Tipo de cobro inválido" };
  }

  const current = await getMpSettings();
  const nueva = input.accessToken?.trim();
  const accessToken = nueva || current.accessToken;

  if (!accessToken) {
    return { error: "Pegá la clave de Mercado Pago" };
  }

  let environment: PaymentEnvironment = input.environment === "auto" ? current.environment : input.environment;
  // Con "auto" y una clave nueva se verifica antes de guardar: una clave mal copiada no se guarda.
  if (input.environment === "auto" && nueva) {
    const detectada = await detectarTipoClave(nueva);
    if ("error" in detectada) return detectada;
    environment = detectada.tipo === "prueba" ? "sandbox" : "production";
  }

  const saved = await savePaymentSettingsRow({
    mp_access_token: accessToken,
    mp_environment: environment,
    mp_enabled: input.enabled,
  });
  if ("error" in saved) return saved;
  return { ok: true, environment };
}

export async function getMpCredentialsForAdmin(): Promise<{
  configured: boolean;
  hasToken: boolean;
  environment: PaymentEnvironment;
  enabled: boolean;
  storedInDb: boolean;
}> {
  const mp = await getMpSettings();
  const configured = isMpConfigured(mp);

  return {
    configured,
    hasToken: Boolean(mp.accessToken.trim()),
    environment: mp.environment,
    enabled: mp.enabled,
    storedInDb: mp.storedInDb,
  };
}

export async function testMpConnection(): Promise<
  { ok: true; environment: string; tokenTipo: "prueba" | "produccion" | "desconocido" } | { error: string }
> {
  const mp = await getMpSettings();
  if (!isMpConfigured(mp)) {
    return { error: "Mercado Pago no está configurado" };
  }

  const detectada = await detectarTipoClave(mp.accessToken);
  if ("error" in detectada) return detectada;
  return { ok: true, environment: mp.environment, tokenTipo: detectada.tipo };
}
