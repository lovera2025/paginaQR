import { TaloClient } from "talo-pay";
import { getAppUrl } from "@/lib/config";
import type { TaloCredentials } from "@/lib/talo/credentials";
import { getTaloCredentials } from "@/lib/talo/credentials";

export function createTaloClient(credentials: TaloCredentials): TaloClient {
  return new TaloClient({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    userId: credentials.userId,
    environment: credentials.environment,
  });
}

export async function getTaloClient(): Promise<
  { client: TaloClient; credentials: TaloCredentials } | { error: string }
> {
  const credentials = await getTaloCredentials();
  if (!credentials.userId || !credentials.clientId || !credentials.clientSecret) {
    return { error: "Talo Pay no está configurado" };
  }

  return {
    client: createTaloClient(credentials),
    credentials,
  };
}

export function getTaloWebhookUrl(): string {
  return `${getAppUrl()}/api/webhook-talo`;
}
