import { getAppMode } from "@/lib/config";
import {
  getPaymentSettings,
  isMpConfigured,
  isTaloConfigured,
  type PaymentSettings,
} from "@/lib/payments/settings";

export type PaymentMethod = "mp" | "talo";

export function metodosHabilitados(settings: PaymentSettings): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (settings.talo.enabled && isTaloConfigured(settings.talo)) methods.push("talo");
  if (settings.mp.enabled && isMpConfigured(settings.mp)) methods.push("mp");
  return methods;
}

export async function getEnabledPaymentMethods(): Promise<PaymentMethod[]> {
  return metodosHabilitados(await getPaymentSettings());
}

/**
 * Simular el pago (botones verde/rojo) solo en local:
 * - APP_MODE=mock → siempre.
 * - APP_MODE=development → solo si no hay ningún medio de pago configurado.
 * - APP_MODE=production → nunca (si no hay medios, la compra no se puede pagar).
 */
export function puedeSimular(mode: ReturnType<typeof getAppMode>, methods: PaymentMethod[]): boolean {
  if (mode === "mock") return true;
  if (mode === "production") return false;
  return methods.length === 0;
}

export async function canSimulatePayment(): Promise<boolean> {
  return puedeSimular(getAppMode(), await getEnabledPaymentMethods());
}

export async function isPaymentMethodAvailable(method: PaymentMethod): Promise<boolean> {
  const methods = await getEnabledPaymentMethods();
  return methods.includes(method);
}
