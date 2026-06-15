import {
  getMpAccessTokenFromEnv,
  getMpEnvironmentFromEnv,
  getTaloClientIdFromEnv,
  getTaloClientSecretFromEnv,
  getTaloEnvironmentFromEnv,
  getTaloUserIdFromEnv,
  isSupabaseConfigured,
} from "@/lib/config";
import { createServerClient } from "@/lib/supabase/server";

export type PaymentEnvironment = "sandbox" | "production";

export interface TaloSettings {
  userId: string;
  clientId: string;
  clientSecret: string;
  environment: PaymentEnvironment;
  enabled: boolean;
  storedInDb: boolean;
}

export interface MpSettings {
  accessToken: string;
  environment: PaymentEnvironment;
  enabled: boolean;
  storedInDb: boolean;
}

export interface PaymentSettings {
  talo: TaloSettings;
  mp: MpSettings;
}

interface MockPaymentStore {
  talo: TaloSettings;
  mp: MpSettings;
}

declare global {
  // eslint-disable-next-line no-var
  var __mockPaymentSettings: MockPaymentStore | undefined;
}

function getMockStore(): MockPaymentStore {
  if (!global.__mockPaymentSettings) {
    global.__mockPaymentSettings = {
      talo: {
        userId: getTaloUserIdFromEnv(),
        clientId: getTaloClientIdFromEnv(),
        clientSecret: getTaloClientSecretFromEnv(),
        environment: getTaloEnvironmentFromEnv(),
        enabled: true,
        storedInDb: false,
      },
      mp: {
        accessToken: getMpAccessTokenFromEnv(),
        environment: getMpEnvironmentFromEnv(),
        enabled: true,
        storedInDb: false,
      },
    };
  }
  return global.__mockPaymentSettings;
}

function getTaloFromEnv(): TaloSettings {
  return {
    userId: getTaloUserIdFromEnv(),
    clientId: getTaloClientIdFromEnv(),
    clientSecret: getTaloClientSecretFromEnv(),
    environment: getTaloEnvironmentFromEnv(),
    enabled: true,
    storedInDb: false,
  };
}

function getMpFromEnv(): MpSettings {
  return {
    accessToken: getMpAccessTokenFromEnv(),
    environment: getMpEnvironmentFromEnv(),
    enabled: true,
    storedInDb: false,
  };
}

interface AppPaymentsRow {
  talo_user_id: string;
  talo_client_id: string;
  talo_client_secret: string;
  environment: string;
  mp_access_token: string;
  mp_environment: string;
  talo_enabled: boolean;
  mp_enabled: boolean;
}

async function getRowFromSupabase(): Promise<AppPaymentsRow | null> {
  const client = createServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from("app_payments")
    .select(
      "talo_user_id, talo_client_id, talo_client_secret, environment, mp_access_token, mp_environment, talo_enabled, mp_enabled"
    )
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) return null;
  return data as AppPaymentsRow;
}

function mapRow(row: AppPaymentsRow): PaymentSettings {
  return {
    talo: {
      userId: row.talo_user_id,
      clientId: row.talo_client_id,
      clientSecret: row.talo_client_secret,
      environment: row.environment === "sandbox" ? "sandbox" : "production",
      enabled: row.talo_enabled !== false,
      storedInDb: true,
    },
    mp: {
      accessToken: row.mp_access_token,
      environment: row.mp_environment === "sandbox" ? "sandbox" : "production",
      enabled: row.mp_enabled !== false,
      storedInDb: true,
    },
  };
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  if (isSupabaseConfigured()) {
    const row = await getRowFromSupabase();
    if (row) return mapRow(row);
    return { talo: getTaloFromEnv(), mp: getMpFromEnv() };
  }
  return getMockStore();
}

export function isTaloConfigured(settings: TaloSettings): boolean {
  return Boolean(
    settings.userId.trim() &&
      settings.clientId.trim() &&
      settings.clientSecret.trim()
  );
}

export function isMpConfigured(settings: MpSettings): boolean {
  return Boolean(settings.accessToken.trim());
}

export async function savePaymentSettingsRow(
  row: Record<string, unknown>
): Promise<{ ok: true } | { error: string }> {
  if (isSupabaseConfigured()) {
    const client = createServerClient();
    if (!client) return { error: "Supabase no disponible" };

    const current = await getRowFromSupabase();
    const payload = {
      id: "default",
      updated_at: new Date().toISOString(),
      ...row,
    };

    const { error } = current
      ? await client.from("app_payments").update(payload).eq("id", "default")
      : await client.from("app_payments").insert(payload);

    if (error) return { error: error.message };
    return { ok: true };
  }

  const store = getMockStore();
  if ("talo_user_id" in row) {
    store.talo.userId = String(row.talo_user_id ?? store.talo.userId);
    store.talo.clientId = String(row.talo_client_id ?? store.talo.clientId);
    store.talo.clientSecret = String(
      row.talo_client_secret ?? store.talo.clientSecret
    );
    store.talo.environment =
      row.environment === "sandbox" ? "sandbox" : "production";
    if (typeof row.talo_enabled === "boolean") {
      store.talo.enabled = row.talo_enabled;
    }
    store.talo.storedInDb = true;
  }
  if ("mp_access_token" in row) {
    store.mp.accessToken = String(row.mp_access_token ?? store.mp.accessToken);
    store.mp.environment =
      row.mp_environment === "sandbox" ? "sandbox" : "production";
    if (typeof row.mp_enabled === "boolean") {
      store.mp.enabled = row.mp_enabled;
    }
    store.mp.storedInDb = true;
  }
  return { ok: true };
}
