import {
  getTaloClientIdFromEnv,
  getTaloClientSecretFromEnv,
  getTaloEnvironmentFromEnv,
  getTaloUserIdFromEnv,
} from "@/lib/config";
import {
  getPaymentSettings,
  isTaloConfigured as isTaloSettingsComplete,
  savePaymentSettingsRow,
  type PaymentEnvironment,
  type TaloSettings,
} from "@/lib/payments/settings";

export type TaloEnvironment = PaymentEnvironment;

export type TaloCredentials = TaloSettings;

export interface SaveTaloCredentialsInput {
  userId: string;
  clientId: string;
  clientSecret?: string;
  environment: TaloEnvironment;
  enabled: boolean;
}

export async function canSimulatePayment(): Promise<boolean> {
  const { canSimulatePayment: check } = await import("@/lib/payments/methods");
  return check();
}

export async function getTaloCredentials(): Promise<TaloCredentials> {
  const settings = await getPaymentSettings();
  return settings.talo;
}

export function isTaloCredentialsComplete(credentials: TaloCredentials): boolean {
  return isTaloSettingsComplete(credentials);
}

export async function isTaloConfigured(): Promise<boolean> {
  const credentials = await getTaloCredentials();
  return isTaloCredentialsComplete(credentials);
}

export async function isTaloEnabled(): Promise<boolean> {
  const credentials = await getTaloCredentials();
  return credentials.enabled && isTaloCredentialsComplete(credentials);
}

export async function saveTaloCredentials(
  input: SaveTaloCredentialsInput
): Promise<{ ok: true } | { error: string }> {
  const userId = input.userId.trim();
  const clientId = input.clientId.trim();
  const incomingSecret = input.clientSecret?.trim() ?? "";

  if (!userId || !clientId) {
    return { error: "Completá User ID y Client ID" };
  }

  if (input.environment !== "sandbox" && input.environment !== "production") {
    return { error: "Ambiente inválido" };
  }

  const current = await getTaloCredentials();
  const clientSecret = incomingSecret || current.clientSecret;

  if (!clientSecret) {
    return { error: "Ingresá el Client Secret" };
  }

  return savePaymentSettingsRow({
    talo_user_id: userId,
    talo_client_id: clientId,
    talo_client_secret: clientSecret,
    environment: input.environment,
    talo_enabled: input.enabled,
  });
}

export async function getTaloCredentialsForAdmin(): Promise<{
  configured: boolean;
  hasSecret: boolean;
  userId: string;
  clientId: string;
  environment: TaloEnvironment;
  enabled: boolean;
  storedInDb: boolean;
}> {
  const credentials = await getTaloCredentials();
  const configured = isTaloCredentialsComplete(credentials);

  return {
    configured,
    hasSecret: Boolean(credentials.clientSecret.trim()),
    userId: credentials.userId,
    clientId: credentials.clientId,
    environment: credentials.environment,
    enabled: credentials.enabled,
    storedInDb: credentials.storedInDb,
  };
}

// Re-export env helpers for backward compatibility
export {
  getTaloUserIdFromEnv,
  getTaloClientIdFromEnv,
  getTaloClientSecretFromEnv,
  getTaloEnvironmentFromEnv,
};
