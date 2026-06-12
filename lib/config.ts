export function getAppMode(): "mock" | "development" | "production" {
  const mode = process.env.APP_MODE ?? "mock";
  if (mode === "development" || mode === "production") return mode;
  return "mock";
}

export function isMockMode(): boolean {
  return getAppMode() === "mock";
}

export function getAdminPin(): string {
  return process.env.ADMIN_PIN ?? "1234";
}

export function getScannerPin(): string {
  return process.env.SCANNER_PIN ?? process.env.ADMIN_PIN ?? "1234";
}
