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
  environment: PaymentEnvironment;
  enabled: boolean;
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
): Promise<{ ok: true } | { error: string }> {
  if (input.environment !== "sandbox" && input.environment !== "production") {
    return { error: "Ambiente inválido" };
  }

  const current = await getMpSettings();
  const accessToken = input.accessToken?.trim() || current.accessToken;

  if (!accessToken) {
    return { error: "Ingresá el Access Token" };
  }

  return savePaymentSettingsRow({
    mp_access_token: accessToken,
    mp_environment: input.environment,
    mp_enabled: input.enabled,
  });
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
  { ok: true; environment: string } | { error: string }
> {
  const mp = await getMpSettings();
  if (!isMpConfigured(mp)) {
    return { error: "Mercado Pago no está configurado" };
  }

  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${mp.accessToken}` },
    });

    if (!res.ok) {
      return {
        error:
          "No pudimos conectar con Mercado Pago. Revisá el Access Token y el ambiente.",
      };
    }

    return { ok: true, environment: mp.environment };
  } catch {
    return { error: "Error de red al conectar con Mercado Pago. Intentá de nuevo." };
  }
}
