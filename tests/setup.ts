import { beforeEach, vi } from "vitest";

// Los tests corren siempre contra la base en memoria (mock): nunca tocan Supabase,
// Mercado Pago, Talo ni mandan mails.
process.env.APP_MODE = "mock";
for (const k of [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "RESEND_API_KEY",
  "MP_ACCESS_TOKEN",
  "MP_ENVIRONMENT",
  "TALO_USER_ID",
  "TALO_CLIENT_ID",
  "TALO_CLIENT_SECRET",
  "TALO_ENVIRONMENT",
  "VERCEL_ENV",
  "AUTH_SECRET",
]) {
  delete process.env[k];
}

vi.mock("@/lib/email/notify", () => ({ notifyOrdenAprobada: vi.fn(async () => {}) }));

beforeEach(() => {
  globalThis.__mockStoreV2 = undefined;
  globalThis.__mockPaymentSettings = undefined;
  globalThis.__mockPins = undefined;
});
