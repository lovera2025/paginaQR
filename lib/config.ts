export function getAppMode(): "mock" | "development" | "production" {
  const mode = process.env.APP_MODE ?? "mock";
  if (mode === "development" || mode === "production") return mode;
  return "mock";
}

export function isMockMode(): boolean {
  return getAppMode() === "mock";
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN?.trim());
}

/** Demo / Fase A–B: simular pago hasta que MP esté conectado (Fase C). */
export function canSimulatePayment(): boolean {
  return isMockMode() || !isMercadoPagoConfigured();
}

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
