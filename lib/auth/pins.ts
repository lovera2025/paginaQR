import { getAdminPin, getScannerPin, isSupabaseConfigured } from "@/lib/config";
import { createServerClient } from "@/lib/supabase/server";
import type { AuthRole } from "@/lib/auth/cookies";

export interface AppPins {
  adminPin: string;
  scannerPin: string;
  pinRevision: number;
  storedInDb: boolean;
}

export interface ChangePinsInput {
  pinActual: string;
  pinAdminNuevo: string;
  pinScannerNuevo: string;
}

interface MockPinsStore {
  adminPin: string;
  scannerPin: string;
  pinRevision: number;
  storedInDb: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __mockPins: MockPinsStore | undefined;
}

function getMockPinsStore(): MockPinsStore {
  if (!global.__mockPins) {
    global.__mockPins = {
      adminPin: getAdminPin(),
      scannerPin: getScannerPin(),
      pinRevision: 0,
      storedInDb: false,
    };
  }
  return global.__mockPins;
}

function validateNewPins(
  newAdmin: string,
  newScanner: string
): { ok: true } | { error: string } {
  if (newAdmin.length < 6) {
    return { error: "El PIN admin debe tener al menos 6 caracteres" };
  }
  if (newScanner.length < 6) {
    return { error: "El PIN scanner debe tener al menos 6 caracteres" };
  }
  if (newAdmin === newScanner) {
    return { error: "El PIN admin y el scanner deben ser distintos" };
  }
  return { ok: true };
}

export function isWeakPin(pin: string): boolean {
  return pin === "1234" || pin.length < 6;
}

async function getAppPinsFromSupabase(): Promise<AppPins | null> {
  const client = createServerClient();
  if (!client) return null;

  const { data, error } = await client
    .from("app_pins")
    .select("admin_pin, scanner_pin, pin_revision")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) return null;

  return {
    adminPin: data.admin_pin,
    scannerPin: data.scanner_pin,
    pinRevision: data.pin_revision,
    storedInDb: true,
  };
}

function getAppPinsFromEnv(): AppPins {
  return {
    adminPin: getAdminPin(),
    scannerPin: getScannerPin(),
    pinRevision: 0,
    storedInDb: false,
  };
}

export async function getAppPins(): Promise<AppPins> {
  if (isSupabaseConfigured()) {
    const fromDb = await getAppPinsFromSupabase();
    if (fromDb) return fromDb;
    return getAppPinsFromEnv();
  }
  return getMockPinsStore();
}

export async function validatePinForRole(
  role: AuthRole,
  pin: string
): Promise<boolean> {
  const pins = await getAppPins();
  if (role === "admin") return pin === pins.adminPin;
  return pin === pins.scannerPin;
}

export async function changeAppPins(
  input: ChangePinsInput
): Promise<{ ok: true; pinRevision: number } | { error: string }> {
  const current = await getAppPins();

  if (input.pinActual !== current.adminPin) {
    return { error: "PIN admin actual incorrecto" };
  }

  const validation = validateNewPins(input.pinAdminNuevo, input.pinScannerNuevo);
  if ("error" in validation) return validation;

  if (isSupabaseConfigured()) {
    const client = createServerClient();
    if (!client) return { error: "Supabase no disponible" };

    const nextRevision = current.storedInDb ? current.pinRevision + 1 : 1;

    if (current.storedInDb) {
      const { error } = await client
        .from("app_pins")
        .update({
          admin_pin: input.pinAdminNuevo,
          scanner_pin: input.pinScannerNuevo,
          pin_revision: nextRevision,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "default");

      if (error) return { error: error.message };
    } else {
      const { error } = await client.from("app_pins").insert({
        id: "default",
        admin_pin: input.pinAdminNuevo,
        scanner_pin: input.pinScannerNuevo,
        pin_revision: nextRevision,
      });

      if (error) return { error: error.message };
    }

    return { ok: true, pinRevision: nextRevision };
  }

  const store = getMockPinsStore();
  store.adminPin = input.pinAdminNuevo;
  store.scannerPin = input.pinScannerNuevo;
  store.pinRevision += 1;
  store.storedInDb = true;
  return { ok: true, pinRevision: store.pinRevision };
}
