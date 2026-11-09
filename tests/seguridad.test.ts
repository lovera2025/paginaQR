import { afterEach, describe, expect, it } from "vitest";
import { getAppMode } from "@/lib/config";
import { destinoPermitido } from "@/lib/auth/destino";
import { firmarSesion, leerSesion, pinIgual, SESSION_MS } from "@/lib/auth/session";
import { avisoModoPrueba } from "@/lib/payments/aviso";
import { puedeSimular } from "@/lib/payments/methods";
import { calcularModoPagos } from "@/lib/payments/modo";
import type { PaymentSettings } from "@/lib/payments/settings";

const SECRETO = "secreto-de-prueba";

describe("sesión de staff", () => {
  it("una sesión firmada se lee bien", () => {
    const v = firmarSesion("admin", 3, 1_000, SECRETO);
    expect(leerSesion(v, 2_000, SECRETO)).toEqual({ role: "admin", pinRevision: 3, exp: 1_000 + SESSION_MS });
  });

  it("no se puede falsificar ni cambiar el rol", () => {
    expect(leerSesion("admin:1", 0, SECRETO)).toBeNull();
    expect(leerSesion("admin:1:99999999999999:abc", 0, SECRETO)).toBeNull();
    const scanner = firmarSesion("scanner", 1, 0, SECRETO);
    const trucha = scanner.replace(/^scanner/, "admin");
    expect(leerSesion(trucha, 1, SECRETO)).toBeNull();
    expect(leerSesion(scanner, 1, "otro-secreto")).toBeNull();
  });

  it("vence a las 12 horas", () => {
    const v = firmarSesion("admin", 1, 0, SECRETO);
    expect(leerSesion(v, SESSION_MS - 1, SECRETO)).not.toBeNull();
    expect(leerSesion(v, SESSION_MS + 1, SECRETO)).toBeNull();
  });

  it("compara PINs", () => {
    expect(pinIgual("123456", "123456")).toBe(true);
    expect(pinIgual("123456", "123457")).toBe(false);
    expect(pinIgual("", "")).toBe(false);
  });

  it("después del login solo vuelve a rutas del staff", () => {
    expect(destinoPermitido("/admin", "admin")).toBe("/admin");
    expect(destinoPermitido("/admin", "scanner")).toBeNull();
    expect(destinoPermitido("/scanner", "scanner")).toBe("/scanner");
    expect(destinoPermitido("//evil.com", "admin")).toBeNull();
    expect(destinoPermitido("/\\evil.com", "admin")).toBeNull();
    expect(destinoPermitido("https://evil.com", "admin")).toBeNull();
    expect(destinoPermitido("/administrador-falso", "admin")).toBeNull();
  });
});

describe("modo de pagos", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  function settings(over: { mp?: Partial<PaymentSettings["mp"]>; talo?: Partial<PaymentSettings["talo"]> } = {}): PaymentSettings {
    return {
      mp: { accessToken: "", environment: "production", enabled: true, storedInDb: true, ...over.mp },
      talo: { userId: "", clientId: "", clientSecret: "", environment: "production", enabled: true, storedInDb: true, ...over.talo },
    };
  }

  it("en producción nunca se simula el pago, aunque no haya medios", () => {
    expect(puedeSimular("production", [])).toBe(false);
    expect(puedeSimular("mock", ["mp"])).toBe(true);
    expect(puedeSimular("development", [])).toBe(true);
    expect(puedeSimular("development", ["mp"])).toBe(false);
  });

  it("en el deploy de producción de Vercel sin APP_MODE se asume producción", () => {
    delete process.env.APP_MODE;
    process.env.VERCEL_ENV = "production";
    expect(getAppMode()).toBe("production");
    delete process.env.VERCEL_ENV;
    expect(getAppMode()).toBe("mock");
  });

  it("detecta modo prueba y avisa en la web", () => {
    const prueba = calcularModoPagos(settings({ mp: { accessToken: "TEST-1", environment: "sandbox" } }), "production");
    expect(prueba).toMatchObject({ simulate: false, sandbox: true, sinMedios: false, methods: ["mp"] });
    expect(avisoModoPrueba(prueba)).toBe("MODO PRUEBA · los pagos no son reales");

    const real = calcularModoPagos(settings({ mp: { accessToken: "APP_USR-1" } }), "production");
    expect(real.sandbox).toBe(false);
    expect(avisoModoPrueba(real)).toBeNull();

    const apagado = calcularModoPagos(settings({ mp: { accessToken: "APP_USR-1", enabled: false } }), "production");
    expect(apagado.sinMedios).toBe(true);

    const local = calcularModoPagos(settings(), "development");
    expect(local.simulate).toBe(true);
    expect(avisoModoPrueba(local)).toBe("MODO SIMULACIÓN · no se cobra nada");
  });
});

describe("login del staff en producción", () => {
  afterEach(() => {
    process.env.APP_MODE = "mock";
    delete process.env.ADMIN_PIN;
    delete process.env.SCANNER_PIN;
  });

  async function login(pin: string) {
    const { POST } = await import("@/app/api/auth/pin/route");
    return POST(
      new Request("http://localhost/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
        body: JSON.stringify({ pin }),
      })
    );
  }

  it("sin PINs configurados no deja entrar con 1234", async () => {
    process.env.APP_MODE = "production";
    const res = await login("1234");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/ADMIN_PIN/);
  });

  it("con PIN de jefe seguro pero el de puerta débil, el de puerta no entra", async () => {
    process.env.APP_MODE = "production";
    process.env.ADMIN_PIN = "908172";
    process.env.SCANNER_PIN = "1234";
    expect((await login("1234")).status).toBe(401);
  });
});
