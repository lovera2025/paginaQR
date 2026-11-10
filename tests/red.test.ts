import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchConReintento } from "@/lib/supabase/server";

function falla(code: string) {
  return Object.assign(new TypeError("fetch failed"), { cause: { code } });
}

describe("conexión con Supabase ante cortes de red", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("una lectura que falla por la red se reintenta", async () => {
    const fetchFalso = vi.fn().mockRejectedValueOnce(falla("UND_ERR_SOCKET")).mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchFalso);
    const r = await fetchConReintento("https://x.supabase.co/rest/v1/eventos", { method: "GET" });
    expect(r.ok).toBe(true);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it("una escritura que pudo haber llegado NO se repite (no duplica compras)", async () => {
    const fetchFalso = vi.fn().mockRejectedValue(falla("UND_ERR_SOCKET"));
    vi.stubGlobal("fetch", fetchFalso);
    await expect(fetchConReintento("https://x.supabase.co/rest/v1/ordenes", { method: "POST", body: "{}" })).rejects.toThrow(
      "fetch failed"
    );
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("una escritura que no llegó a salir (sin conexión) se reintenta", async () => {
    const fetchFalso = vi.fn().mockRejectedValueOnce(falla("ECONNREFUSED")).mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchFalso);
    const r = await fetchConReintento("https://x.supabase.co/rest/v1/app_payments", { method: "PATCH", body: "{}" });
    expect(r.ok).toBe(true);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });
});
