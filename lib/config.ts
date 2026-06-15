export function getAppMode(): "mock" | "development" | "production" {
  const mode = process.env.APP_MODE ?? "mock";
  if (mode === "development" || mode === "production") return mode;
  return "mock";
}

export function isMockMode(): boolean {
  return getAppMode() === "mock";
}

export function getTaloUserIdFromEnv(): string {
  return process.env.TALO_USER_ID?.trim() || "";
}

export function getTaloClientIdFromEnv(): string {
  return process.env.TALO_CLIENT_ID?.trim() || "";
}

export function getTaloClientSecretFromEnv(): string {
  return process.env.TALO_CLIENT_SECRET?.trim() || "";
}

export function getTaloEnvironmentFromEnv(): "sandbox" | "production" {
  return process.env.TALO_ENVIRONMENT?.trim() === "sandbox"
    ? "sandbox"
    : "production";
}

export function isTaloConfiguredFromEnv(): boolean {
  return Boolean(
    getTaloUserIdFromEnv() &&
      getTaloClientIdFromEnv() &&
      getTaloClientSecretFromEnv()
  );
}

export function getMpAccessTokenFromEnv(): string {
  return process.env.MP_ACCESS_TOKEN?.trim() || "";
}

export function getMpEnvironmentFromEnv(): "sandbox" | "production" {
  return process.env.MP_ENVIRONMENT?.trim() === "sandbox"
    ? "sandbox"
    : "production";
}

export function isMercadoPagoConfiguredFromEnv(): boolean {
  return Boolean(getMpAccessTokenFromEnv());
}

/** Demo / local: simular pago hasta que Talo esté conectado. */
export function getAdminPin(): string {
  return process.env.ADMIN_PIN ?? "1234";
}

export function getScannerPin(): string {
  return process.env.SCANNER_PIN ?? process.env.ADMIN_PIN ?? "1234";
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key);
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getResendFrom(): string {
  return process.env.RESEND_FROM?.trim() || "JR Eventos <onboarding@resend.dev>";
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}
