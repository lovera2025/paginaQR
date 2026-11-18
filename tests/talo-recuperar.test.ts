import type { PaymentResponse } from "talo-pay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { approveOrden, cerrarEvento, createOrdenPendiente, getActivity, getOrden, getTicketsByOrden, setOrdenPaymentId } from "@/lib/db";
import { processMpPayment } from "@/lib/mercadopago/payments";
import { ordenPublica } from "@/lib/entradas/publica";
import { savePaymentSettingsRow } from "@/lib/payments/settings";
import { normalizarDni, normalizarNacimiento, validarIdentidad } from "@/lib/entradas/identidad";
import { esNavegadorInterno } from "@/lib/utils";

// Talo falso: guarda los pagos en memoria. Nunca se llama a la API real.
const talo = vi.hoisted(() => {
  const pagos = new Map<string, Record<string, unknown>>();
  let n = 0;
  const state = { falla: false, creados: 0 };
  const client = {
    payments: {
      get: async (id: string) => {
        if (state.falla) throw new Error("Talo no responde");
        const p = pagos.get(id);
        if (!p) throw new Error("No existe");
        return { ...p };
      },
      create: async (body: { external_id: string; price: { amount: number } }) => {
        n += 1;
        state.creados += 1;
        const id = `VAR-cuenta-pago${n}`;
        const p = {
          id,
          payment_status: "PENDING",
          external_id: body.external_id,
          quotes: [{ network: "transfer", alias: `alias.${n}`, cvu: `000000${n}`, amount: body.price.amount }],
          transactions: [],
        };
        pagos.set(id, p);
        return { ...p };
      },
    },
  };
  return {
    pagos,
    state,
    client,
    /** Simula lo que pasa en Talo cuando llega una transferencia. */
    transferir(id: string, monto: number, total: number) {
      const p = pagos.get(id)!;
      const tx = [...((p.transactions as { amount: number }[]) ?? []), { amount: monto }];
      const suma = tx.reduce((s, t) => s + t.amount, 0);
      p.transactions = tx;
      p.payment_status = suma >= total ? (suma > total ? "OVERPAID" : "SUCCESS") : "UNDERPAID";
    },
    vencer(id: string) {
      pagos.get(id)!.payment_status = "EXPIRED";
    },
    reset() {
      pagos.clear();
      n = 0;
      state.falla = false;
      state.creados = 0;
    },
  };
});

vi.mock("@/lib/talo/client", () => ({
  getTaloClient: async () => ({
    client: talo.client,
    credentials: { userId: "u", clientId: "c", clientSecret: "s", environment: "sandbox" },
  }),
  getTaloWebhookUrl: () => "https://ejemplo.test/api/webhook-talo",
  createTaloClient: () => talo.client,
}));

import { POST as pagarTalo } from "@/app/api/talo/payment/route";
import { POST as syncTalo } from "@/app/api/talo/sync/route";
import { POST as webhookTalo } from "@/app/api/webhook-talo/route";
import { POST as recuperar } from "@/app/api/recuperar/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { GET as verOrden } from "@/app/api/ordenes/[id]/route";

const AHORA = new Date("2026-11-20T12:00:00-03:00");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  talo.reset();
  globalThis.__limites = undefined;
  await savePaymentSettingsRow({
    talo_user_id: "u",
    talo_client_id: "c",
    talo_client_secret: "s",
    environment: "sandbox",
    talo_enabled: true,
  });
});
afterEach(() => {
  vi.useRealTimers();
});

function req(url: string, body: unknown, ip = "1.2.3.4") {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

async function ordenPendiente(cantidad = 1, dni = "40123456", nacimiento = "2008-03-15") {
  const r = await createOrdenPendiente({
    eventoId: "rec-pinaroli",
    tipoEntradaId: "rec-pinaroli-anticipada",
    compradorNombre: "Comprador Test",
    compradorEmail: "test@example.com",
    cantidad,
    compradorDni: dni,
    compradorNacimiento: nacimiento,
  });
  if ("error" in r) throw new Error(r.error);
  return r.orden;
}

async function pedirDatos(ordenId: string) {
  const res = await pagarTalo(req("http://local/api/talo/payment", { ordenId }));
  const data = await res.json();
  // El id del pago ya no viaja al navegador: para simular la transferencia se toma de la compra.
  expect(data.paymentId).toBeUndefined();
  return { status: res.status, data: { ...data, paymentId: (await getOrden(ordenId))?.paymentId ?? "" } };
}

function minutos(m: number) {
  vi.setSystemTime(new Date(AHORA.getTime() + m * 60_000));
}

describe("DNI y fecha de nacimiento", () => {
  it("normaliza el DNI y rechaza los que no sirven", () => {
    expect(normalizarDni("40.123.456")).toBe("40123456");
    expect(normalizarDni(" 7 123 456 ")).toBe("7123456");
    expect(normalizarDni("123")).toBeNull();
    expect(normalizarDni("123456789")).toBeNull();
    expect(normalizarDni("")).toBeNull();
  });

  it("valida fechas reales y no futuras", () => {
    expect(normalizarNacimiento({ dia: "5", mes: "3", anio: "2008" }, AHORA)).toBe("2008-03-05");
    expect(normalizarNacimiento("2008-03-05", AHORA)).toBe("2008-03-05");
    expect(normalizarNacimiento({ dia: "31", mes: "2", anio: "2008" }, AHORA)).toBeNull();
    expect(normalizarNacimiento({ dia: "1", mes: "1", anio: "2030" }, AHORA)).toBeNull();
    expect(normalizarNacimiento({ dia: "1", mes: "1", anio: "1900" }, AHORA)).toBeNull();
    expect(validarIdentidad("40123456", { dia: "", mes: "", anio: "" })).toMatch(/fecha/);
  });

  it("el checkout pide DNI y fecha, y los guarda", async () => {
    const base = {
      eventoId: "rec-pinaroli",
      tipoEntradaId: "rec-pinaroli-anticipada",
      cantidad: 1,
      compradorNombre: "Ana Test",
      compradorEmail: "ana@example.com",
    };
    const sinDni = await checkout(req("http://local/api/checkout", base));
    expect(sinDni.status).toBe(400);
    expect((await sinDni.json()).error).toMatch(/DNI/);

    const ok = await checkout(
      req("http://local/api/checkout", { ...base, compradorDni: "40.123.456", compradorNacimiento: { dia: "15", mes: "3", anio: "2008" } })
    );
    expect(ok.status).toBe(200);
    const data = await ok.json();
    const orden = await getOrden(data.ordenId);
    expect(orden?.compradorDni).toBe("40123456");
    expect(orden?.compradorNacimiento).toBe("2008-03-15");
    // Lo que viaja al navegador no lleva el DNI ni la fecha.
    expect(data.orden.compradorDni).toBeUndefined();
    expect(data.orden.compradorNacimiento).toBeUndefined();
  });

  it("la API pública de la compra no muestra DNI, fecha ni pagos", async () => {
    const o = await ordenPendiente();
    const res = await verOrden(new Request(`http://local/api/ordenes/${o.id}`), { params: { id: o.id } });
    const data = await res.json();
    expect(data.id).toBe(o.id);
    expect(data.compradorDni).toBeUndefined();
    expect(data.compradorNacimiento).toBeUndefined();
    expect(data.pagosTalo).toBeUndefined();
  });
});

describe("Talo: nunca perder una transferencia", () => {
  it("recargar la página con la transferencia hecha aprueba la compra y no genera otro alias", async () => {
    const o = await ordenPendiente();
    const primero = await pedirDatos(o.id);
    expect(primero.data.tipo).toBe("transferir");
    talo.transferir(primero.data.paymentId, o.montoTotal, o.montoTotal);

    const recarga = await pedirDatos(o.id);
    expect(recarga.data).toMatchObject({ tipo: "aprobada" });
    expect(talo.state.creados).toBe(1);
    expect((await getOrden(o.id))?.estado).toBe("aprobado");
    expect(await getTicketsByOrden(o.id)).toHaveLength(1);
  });

  it("recargar sin haber pagado muestra el mismo alias", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    const b = await pedirDatos(o.id);
    expect(b.data.alias).toBe(a.data.alias);
    expect(talo.state.creados).toBe(1);
  });

  it("pasados los 10 minutos, con la transferencia iniciada, no dice que venció", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    minutos(40);
    const b = await pedirDatos(o.id);
    expect(b.status).toBe(200);
    expect(b.data.alias).toBe(a.data.alias);
    talo.transferir(a.data.paymentId, o.montoTotal, o.montoTotal);
    expect((await pedirDatos(o.id)).data).toMatchObject({ tipo: "aprobada" });
  });

  it("sin transferencia iniciada, pasado el tiempo sí vence", async () => {
    const o = await ordenPendiente();
    minutos(40);
    const r = await pedirDatos(o.id);
    expect(r.status).toBe(410);
    expect(r.data.vencida).toBe(true);
    expect(talo.state.creados).toBe(0);
  });

  it("si Talo no responde, no genera otro alias encima", async () => {
    const o = await ordenPendiente();
    await pedirDatos(o.id);
    talo.state.falla = true;
    const r = await pedirDatos(o.id);
    expect(r.status).toBe(502);
    talo.state.falla = false;
    expect(talo.state.creados).toBe(1);
  });

  it("transferencia de menos: avisa cuánto llegó, no emite y no genera otro alias", async () => {
    const o = await ordenPendiente(2);
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, 10000, o.montoTotal);

    const r = await pedirDatos(o.id);
    expect(r.data.tipo).toBe("incompleto");
    expect(r.data.recibido).toBe(10000);
    expect(talo.state.creados).toBe(1);
    const final = await getOrden(o.id);
    expect(final?.estado).toBe("pendiente");
    expect(final?.montoRecibido).toBe(10000);
    expect(await getTicketsByOrden(o.id)).toHaveLength(0);
    expect((await getActivity()).some((a) => a.mensaje.includes("TRANSFIRIÓ DE MENOS"))).toBe(true);

    // Si completa lo que falta, se aprueba y se borra el aviso.
    talo.transferir(a.data.paymentId, o.montoTotal - 10000, o.montoTotal);
    const sync = await syncTalo(req("http://local/api/talo/sync", { ordenId: o.id }));
    expect((await sync.json()).status).toBe("SUCCESS");
    const aprobada = await getOrden(o.id);
    expect(aprobada?.estado).toBe("aprobado");
    expect(aprobada?.montoRecibido).toBeNull();
  });

  it("alias vencido en Talo: genera uno nuevo y, si pagan el viejo igual, se encuentra", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    talo.vencer(a.data.paymentId);
    const b = await pedirDatos(o.id);
    expect(b.data.paymentId).not.toBe(a.data.paymentId);
    expect(talo.state.creados).toBe(2);
    expect((await getOrden(o.id))?.pagosTalo).toEqual([a.data.paymentId, b.data.paymentId]);

    // El aviso de que venció el alias viejo no cierra la compra (tiene uno más nuevo).
    const aviso = await webhookTalo(req("http://local/api/webhook-talo", { paymentId: a.data.paymentId, externalId: o.id, message: "x" }));
    expect(aviso.status).toBe(200);
    expect((await getOrden(o.id))?.estado).toBe("pendiente");

    // Transfirió al alias viejo: el sync revisa todos los pagos de la compra.
    talo.pagos.get(a.data.paymentId)!.payment_status = "SUCCESS";
    await syncTalo(req("http://local/api/talo/sync", { ordenId: o.id }));
    expect((await getOrden(o.id))?.estado).toBe("aprobado");
  });

  it("el aviso automático de Talo aprueba con la pantalla cerrada y queda en Actividad", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, o.montoTotal, o.montoTotal);
    const res = await webhookTalo(req("http://local/api/webhook-talo", { paymentId: a.data.paymentId, externalId: o.id, message: "pago" }));
    expect(res.status).toBe(200);
    expect((await getOrden(o.id))?.estado).toBe("aprobado");
    const actividad = (await getActivity()).map((x) => x.mensaje);
    expect(actividad.some((m) => m.startsWith("Aviso automático de Talo") && m.includes("transferencia recibida"))).toBe(true);
    // En Actividad se distingue cada pago (antes todos decían "VAR-c43bb66c").
    expect(actividad.some((m) => m.includes(a.data.paymentId.slice(-8)))).toBe(true);
  });
});

describe("Recuperar mis entradas (DNI + fecha de nacimiento)", () => {
  async function buscar(dni: string, nacimiento: string, ip = "1.2.3.4") {
    const res = await recuperar(req("http://local/api/recuperar", { dni, nacimiento }, ip));
    return { status: res.status, data: await res.json() };
  }

  it("encuentra la compra pendiente, consulta Talo y la aprueba en el momento", async () => {
    const o = await ordenPendiente(2);
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, o.montoTotal, o.montoTotal);

    const r = await buscar("40.123.456", "2008-03-15");
    expect(r.status).toBe(200);
    expect(r.data.compras).toHaveLength(1);
    expect(r.data.compras[0]).toMatchObject({ ordenId: o.id, estado: "pagada", cantidad: 2 });
    expect(await getTicketsByOrden(o.id)).toHaveLength(2);
  });

  it("si la transferencia no llegó, la muestra esperando y sin entradas", async () => {
    const o = await ordenPendiente();
    await pedirDatos(o.id);
    const r = await buscar("40123456", "2008-03-15");
    expect(r.data.compras[0]).toMatchObject({ ordenId: o.id, estado: "esperando" });
    expect(await getTicketsByOrden(o.id)).toHaveLength(0);
  });

  it("no muestra compras abandonadas antes de pagar", async () => {
    await ordenPendiente();
    const r = await buscar("40123456", "2008-03-15");
    expect(r.status).toBe(404);
  });

  it("con la fecha equivocada no muestra nada ni dice qué dato falló", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, o.montoTotal, o.montoTotal);
    await pedirDatos(o.id);

    const r = await buscar("40123456", "2008-03-16");
    expect(r.status).toBe(404);
    expect(r.data.compras).toBeUndefined();
    expect(r.data.error).toMatch(/DNI y la fecha/);
    const otro = await buscar("40123457", "2008-03-15");
    expect(otro.data.error).toBe(r.data.error);
  });

  it("frena a quien prueba muchas fechas para el mismo DNI (los aciertos también cuentan)", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, o.montoTotal, o.montoTotal);
    // Un acierto en el medio no reinicia el tope.
    expect((await buscar("40123456", "2008-03-15", "7.7.7.7")).status).toBe(200);
    for (let d = 1; d <= 7; d++) {
      expect((await buscar("40123456", `2008-01-0${d}`, `9.9.9.${d}`)).status).toBe(404);
    }
    // Ni con la fecha correcta ni desde otra IP: hay que esperar.
    expect((await buscar("40123456", "2008-03-15", "8.8.8.8")).status).toBe(429);
  });

  it("cada recuperación queda anotada en Actividad (sin la IP completa)", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, o.montoTotal, o.montoTotal);
    await buscar("40123456", "2008-03-15", "190.12.34.56");
    const linea = (await getActivity()).map((x) => x.mensaje).find((m) => m.startsWith("Recuperar mis entradas"));
    expect(linea).toContain(o.id.slice(0, 8).toUpperCase());
    expect(linea).toContain("190.12.34.x");
  });
});

describe("navegador de las apps", () => {
  it("detecta Instagram, Facebook y TikTok, no Chrome ni Safari", () => {
    expect(esNavegadorInterno("Mozilla/5.0 (Linux; Android 14) ... Instagram 310.0.0.0 Android")).toBe(true);
    expect(esNavegadorInterno("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) ... [FBAN/FBIOS;FBAV/450.0]")).toBe(true);
    expect(esNavegadorInterno("Mozilla/5.0 (Linux; Android 13) ... musical_ly_2023 BytedanceWebview")).toBe(true);
    expect(esNavegadorInterno("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36")).toBe(false);
    expect(esNavegadorInterno("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});

describe("plata que no se pierde de vista", () => {
  it("si la compra ya estaba paga y llega otra transferencia, queda marcada PAGO DOBLE", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    talo.vencer(a.data.paymentId);
    const b = await pedirDatos(o.id);
    talo.transferir(b.data.paymentId, o.montoTotal, o.montoTotal);
    await syncTalo(req("http://local/api/talo/sync", { ordenId: o.id }));
    expect((await getOrden(o.id))?.estado).toBe("aprobado");

    // Llega plata también al alias viejo (Talo la acredita igual): hay que devolver uno.
    talo.pagos.get(a.data.paymentId)!.payment_status = "SUCCESS";
    talo.pagos.get(a.data.paymentId)!.transactions = [{ amount: o.montoTotal }];
    await webhookTalo(req("http://local/api/webhook-talo", { paymentId: a.data.paymentId, externalId: o.id, message: "x" }));
    await webhookTalo(req("http://local/api/webhook-talo", { paymentId: a.data.paymentId, externalId: o.id, message: "x" }));
    const final = await getOrden(o.id);
    expect(final?.estado).toBe("aprobado");
    expect(final?.problema).toBe("pago_doble");
    expect(await getTicketsByOrden(o.id)).toHaveLength(1);
    const avisos = (await getActivity()).filter((x) => x.mensaje.includes("PAGO DOBLE"));
    expect(avisos).toHaveLength(1);
  });

  it("transferencia + Mercado Pago para la misma compra: el segundo pago queda para devolver", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, o.montoTotal, o.montoTotal);
    await syncTalo(req("http://local/api/talo/sync", { ordenId: o.id }));
    await processMpPayment({ id: 555, status: "approved", external_reference: o.id, transaction_amount: o.montoTotal });
    expect((await getOrden(o.id))?.problema).toBe("pago_doble");
  });

  it("el mismo aviso repetido del pago que aprobó no es un pago doble", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, o.montoTotal, o.montoTotal);
    for (let i = 0; i < 3; i++) {
      await webhookTalo(req("http://local/api/webhook-talo", { paymentId: a.data.paymentId, externalId: o.id, message: "x" }));
    }
    expect((await getOrden(o.id))?.problema ?? null).toBeNull();
    // Solo el primer aviso queda en Actividad (los repetidos de una compra ya paga, no).
    expect((await getActivity()).filter((x) => x.mensaje.startsWith("Aviso automático de Talo"))).toHaveLength(1);
  });

  it("los avisos de 'esperando' no llenan la Actividad", async () => {
    const o = await ordenPendiente();
    const a = await pedirDatos(o.id);
    for (let i = 0; i < 5; i++) {
      await webhookTalo(req("http://local/api/webhook-talo", { paymentId: a.data.paymentId, externalId: o.id, message: "x" }));
    }
    expect((await getActivity()).some((x) => x.mensaje.startsWith("Aviso automático de Talo"))).toBe(false);
  });

  it("cerrar la fiesta no esconde una transferencia de menos", async () => {
    const o = await ordenPendiente(2);
    const a = await pedirDatos(o.id);
    talo.transferir(a.data.paymentId, 5000, o.montoTotal);
    await syncTalo(req("http://local/api/talo/sync", { ordenId: o.id }));
    const r = await cerrarEvento("rec-pinaroli");
    expect("error" in r).toBe(false);
    const final = await getOrden(o.id);
    expect(final?.estado).toBe("pendiente");
    expect(final?.montoRecibido).toBe(5000);
  });

  it("si la compra se cerró mientras se generaba el alias, el pago igual queda guardado y no se muestra el alias", async () => {
    const o = await ordenPendiente();
    await pedirDatos(o.id);
    const { rejectOrden } = await import("@/lib/db");
    await rejectOrden(o.id);
    const r = await setOrdenPaymentId(o.id, "VAR-cuenta-tardio", "talo");
    expect(r).toEqual({ ok: true, estado: "rechazado" });
    expect((await getOrden(o.id))?.pagosTalo).toContain("VAR-cuenta-tardio");
  });

  it("lo que viaja al navegador no lleva ids de pago, DNI ni fecha", async () => {
    const o = await ordenPendiente();
    await pedirDatos(o.id);
    const pub = ordenPublica((await getOrden(o.id))!) as Record<string, unknown>;
    expect(pub.paymentId).toBeUndefined();
    expect(pub.pagosTalo).toBeUndefined();
    expect(pub.compradorDni).toBeUndefined();
    expect(pub.pagoIniciado).toBe(true);
  });

  it("aprobar dos veces la misma compra no duplica las entradas", async () => {
    const o = await ordenPendiente(3);
    await approveOrden(o.id, "pago-x", "talo");
    await approveOrden(o.id, "pago-x", "talo");
    expect(await getTicketsByOrden(o.id)).toHaveLength(3);
  });
});
