import { getAppMode } from "@/lib/config";
import { metodosHabilitados, puedeSimular, type PaymentMethod } from "@/lib/payments/methods";
import {
  getPaymentSettings,
  isMpConfigured,
  isTaloConfigured,
  type PaymentEnvironment,
  type PaymentSettings,
} from "@/lib/payments/settings";

export interface EstadoMedio {
  enabled: boolean;
  configured: boolean;
  environment: PaymentEnvironment;
  /** Lo ve el comprador (habilitado y configurado). */
  activo: boolean;
}

export interface ModoPagos {
  appMode: ReturnType<typeof getAppMode>;
  /** El comprador ve los botones de simular pago (no se cobra nada). */
  simulate: boolean;
  /** Algún medio activo usa credenciales de prueba. */
  sandbox: boolean;
  /** No hay forma de pagar (producción sin medios activos). */
  sinMedios: boolean;
  methods: PaymentMethod[];
  mp: EstadoMedio;
  talo: EstadoMedio;
}

export function calcularModoPagos(settings: PaymentSettings, appMode: ReturnType<typeof getAppMode>): ModoPagos {
  const methods = metodosHabilitados(settings);
  const simulate = puedeSimular(appMode, methods);
  const mp: EstadoMedio = {
    enabled: settings.mp.enabled,
    configured: isMpConfigured(settings.mp),
    environment: settings.mp.environment,
    activo: methods.includes("mp"),
  };
  const talo: EstadoMedio = {
    enabled: settings.talo.enabled,
    configured: isTaloConfigured(settings.talo),
    environment: settings.talo.environment,
    activo: methods.includes("talo"),
  };
  const sandbox =
    !simulate && ((mp.activo && mp.environment === "sandbox") || (talo.activo && talo.environment === "sandbox"));
  return { appMode, simulate, sandbox, sinMedios: !simulate && methods.length === 0, methods, mp, talo };
}

export async function getModoPagos(): Promise<ModoPagos> {
  return calcularModoPagos(await getPaymentSettings(), getAppMode());
}
