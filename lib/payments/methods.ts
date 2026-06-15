import { isMockMode } from "@/lib/config";
import {
  getPaymentSettings,
  isMpConfigured,
  isTaloConfigured,
} from "@/lib/payments/settings";

export type PaymentMethod = "mp" | "talo";

export async function getEnabledPaymentMethods(): Promise<PaymentMethod[]> {
  const settings = await getPaymentSettings();
  const methods: PaymentMethod[] = [];

  if (settings.talo.enabled && isTaloConfigured(settings.talo)) {
    methods.push("talo");
  }
  if (settings.mp.enabled && isMpConfigured(settings.mp)) {
    methods.push("mp");
  }

  return methods;
}

export async function canSimulatePayment(): Promise<boolean> {
  if (isMockMode()) return true;
  const methods = await getEnabledPaymentMethods();
  return methods.length === 0;
}

export async function isPaymentMethodAvailable(
  method: PaymentMethod
): Promise<boolean> {
  const methods = await getEnabledPaymentMethods();
  return methods.includes(method);
}
