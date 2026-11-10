import { createClient } from "@supabase/supabase-js";

const ESPERAS_MS = [300, 1000];
const LECTURAS = new Set(["GET", "HEAD"]);
// Errores en los que el pedido no llegó a Supabase (no hay conexión o no se encontró el servidor):
// se puede repetir aunque sea una escritura, porque no se hizo nada.
const NO_LLEGO = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|ConnectTimeout/i;

function causaDe(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const causa = (e as Error & { cause?: { code?: string; name?: string; message?: string } }).cause;
  return [e.message, causa?.code, causa?.name, causa?.message].filter(Boolean).join(" ");
}

/**
 * fetch con reintento ante cortes de red momentáneos ("fetch failed"). Las lecturas se repiten
 * siempre; las escrituras solo si el pedido no llegó a salir (así nunca se duplica una compra).
 */
export async function fetchConReintento(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const metodo = (init?.method ?? "GET").toUpperCase();
  for (let intento = 0; ; intento++) {
    try {
      return await fetch(input, { ...init, cache: "no-store" });
    } catch (e) {
      const espera = ESPERAS_MS[intento];
      const repetible = LECTURAS.has(metodo) || NO_LLEGO.test(causaDe(e));
      if (!repetible || espera === undefined || init?.signal?.aborted) throw e;
      await new Promise((ok) => setTimeout(ok, espera));
    }
  }
}

export function createServerClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchConReintento },
  });
}
