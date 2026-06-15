import {
  getTaloClientIdFromEnv,
  getTaloClientSecretFromEnv,
  getTaloEnvironmentFromEnv,
  getTaloUserIdFromEnv,
  isMockMode,
  isSupabaseConfigured,
} from "@/lib/config";
import { createServerClient } from "@/lib/supabase/server";

export async function canSimulatePayment(): Promise<boolean> {
  if (isMockMode()) return true;
  return !(await isTaloConfigured());
}

export type TaloEnvironment = "sandbox" | "production";

export interface TaloCredentials {
  userId: string;
  clientId: string;
  clientSecret: string;
  environment: TaloEnvironment;
  storedInDb: boolean;
}

export interface SaveTaloCredentialsInput {
  userId: string;
  clientId: string;
  clientSecret?: string;
  environment: TaloEnvironment;
}

interface MockPaymentsStore {
  userId: string;
  clientId: string;
  clientSecret: string;
  environment: TaloEnvironment;
  storedInDb: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __mockTaloCredentials: MockPaymentsStore | undefined;
}

function getMockStore(): MockPaymentsStore {
  if (!global.__mockTaloCredentials) {
    global.__mockTaloCredentials = {
      userId: getTaloUserIdFromEnv(),
      clientId: getTaloClientIdFromEnv(),
      clientSecret: getTaloClientSecretFromEnv(),
      environment: getTaloEnvironmentFromEnv(),
      storedInDb: false,
    };
  }
  return global.__mockTaloCredentials;
}

function getCredentialsFromEnv(): TaloCredentials {
  return {
    userId: getTaloUserIdFromEnv(),
    clientId: getTaloClientIdFromEnv(),
    clientSecret: getTaloClientSecretFromEnv(),
    environment: getTaloEnvironmentFromEnv(),
    storedInDb: false,
  };
}

async function getCredentialsFromSupabase(): Promise<TaloCredentials | null> {
  const client = createServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from("app_payments")
    .select("talo_user_id, talo_client_id, talo_client_secret, environment")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) return null;

  return {
    userId: data.talo_user_id,
    clientId: data.talo_client_id,
    clientSecret: data.talo_client_secret,
    environment: data.environment === "sandbox" ? "sandbox" : "production",
    storedInDb: true,
  };
}

export function isTaloCredentialsComplete(credentials: TaloCredentials): boolean {
  return Boolean(
    credentials.userId.trim() &&
      credentials.clientId.trim() &&
      credentials.clientSecret.trim()
  );
}

export async function getTaloCredentials(): Promise<TaloCredentials> {
  if (isSupabaseConfigured()) {
    const fromDb = await getCredentialsFromSupabase();
    if (fromDb) return fromDb;
    return getCredentialsFromEnv();
  }
  return getMockStore();
}

export async function isTaloConfigured(): Promise<boolean> {
  const credentials = await getTaloCredentials();
  return isTaloCredentialsComplete(credentials);
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

  if (isSupabaseConfigured()) {
    const client = createServerClient();
    if (!client) return { error: "Supabase no disponible" };

    const current = await getCredentialsFromSupabase();
    const row = {
      id: "default",
      talo_user_id: userId,
      talo_client_id: clientId,
      talo_client_secret: clientSecret,
      environment: input.environment,
      updated_at: new Date().toISOString(),
    };

    const { error } = current
      ? await client.from("app_payments").update(row).eq("id", "default")
      : await client.from("app_payments").insert(row);

    if (error) return { error: error.message };
    return { ok: true };
  }

  const store = getMockStore();
  store.userId = userId;
  store.clientId = clientId;
  store.clientSecret = clientSecret;
  store.environment = input.environment;
  store.storedInDb = true;
  return { ok: true };
}

export async function getTaloCredentialsForAdmin(): Promise<{
  configured: boolean;
  hasSecret: boolean;
  userId: string;
  clientId: string;
  environment: TaloEnvironment;
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
    storedInDb: credentials.storedInDb,
  };
}
