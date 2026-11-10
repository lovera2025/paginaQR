import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveOrden,
  cerrarEvento,
  cerrarPagoSinCupo,
  createOrdenPendiente,
  getActivity,
  getAdminStats,
  getEventoCatalogo,
  getOrden,
  getTicketsByOrden,
  updateTipo,
} from "@/lib/db";
import { evaluarTipos, reservasVigentes, RESERVA_MINUTOS } from "@/lib/entradas/tipos";
import { processMpPayment } from "@/lib/mercadopago/payments";
import { isoArgentina, preferenciaBody } from "@/lib/mercadopago/preferences";
import { reservaVencida } from "@/lib/payments/reserva";
import { processTaloPayment } from "@/lib/talo/payments";
import { traerTodo, TAM_PAGINA } from "@/lib/supabase/paginar";
import { crearLimite } from "@/lib/limite";
import { AHORA, evento, orden, tipo } from "./helpers";
import type { PaymentResponse } from "talo-pay";

const FIESTA = "rec-pinaroli";
const ANTICIPADA = `${FIESTA}-anticipada`;
const T0 = new Date("2026-11-20T12:00:00-03:00");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

function minutos(n: number) {
  vi.setSystemTime(new Date(Date.now() + n * 60_000));
}

async function comprar(cantidad: number, nombre = "Comprador Test") {
  return createOrdenPendiente({
    eventoId: FIESTA,
    tipoEntradaId: ANTICIPADA,
    compradorNombre: nombre,
    compradorEmail: "test@example.com",
    cantidad,
  });
}

async function comprarOk(cantidad: number, nombre?: string) {
  const r = await comprar(cantidad, nombre);
  if ("error" in r) throw new Error(r.error);
  return r.orden;
}

describe("reglas de reserva", () => {
  it("una compra sin pagar ocupa lugar del tipo y de la fiesta", () => {
    const [t] = evaluarTipos(evento({ capacidad: 10 }), [tipo({ cupo: 5 })], [], AHORA, [
      { tipoEntradaId: "t-gen", cantidad: 3 },
    ]);
    expect(t.disponibles).toBe(2);
    expect(t.vendidas).toBe(0);

    const [lleno] = evaluarTipos(evento({ capacidad: 4 }), [tipo()], [], AHORA, [{ tipoEntradaId: "otro", cantidad: 4 }]);
    expect(lleno.fase).toBe("agotada");
  });

  it("solo cuentan las pendientes recientes y sin problema de pago", () => {
    const reciente = new Date(AHORA.getTime() - 5 * 60_000).toISOString();
    const vieja = new Date(AHORA.getTime() - (RESERVA_MINUTOS + 1) * 60_000).toISOString();
    const r = reservasVigentes(
      [
        orden({ estado: "pendiente", createdAt: reciente, cantidad: 2 }),
        orden({ estado: "pendiente", createdAt: vieja, cantidad: 5 }),
        orden({ estado: "aprobado", createdAt: reciente, cantidad: 7 }),
        orden({ estado: "pendiente", createdAt: reciente, cantidad: 9, problema: "pago_sin_cupo" }),
      ],
      AHORA
    );
    expect(r).toEqual([{ tipoEntradaId: "t-gen", cantidad: 2 }]);
  });

  it("el link de pago vence a los 10 minutos de la compra", () => {
    const o = { createdAt: T0.toISOString() };
    expect(reservaVencida(o, new Date(T0.getTime() + 9 * 60_000))).toBe(false);
    expect(reservaVencida(o, new Date(T0.getTime() + 11 * 60_000))).toBe(true);
  });
});

describe("reserva en la compra", () => {
  it("si las últimas están reservadas, la siguiente compra se rechaza; al vencer se liberan", async () => {
    await updateTipo(ANTICIPADA, { cupo: 2 });
    await comprarOk(2);
    const r = await comprar(1);
    expect("error" in r && r.error).toMatch(/agotada/i);
    expect((await getEventoCatalogo(FIESTA))?.tipos.find((t) => t.id === ANTICIPADA)?.disponibles).toBe(0);

    minutos(RESERVA_MINUTOS + 1);
    expect("orden" in (await comprar(1))).toBe(true);
  });

  it("una compra cancelada libera su lugar enseguida; una tarjeta rechazada no (puede reintentar)", async () => {
    await updateTipo(ANTICIPADA, { cupo: 1 });
    const o = await comprarOk(1);
    expect("error" in (await comprar(1))).toBe(true);
    await processMpPayment({ id: 299, status: "rejected", external_reference: o.id });
    expect("error" in (await comprar(1))).toBe(true);
    await processMpPayment({ id: 300, status: "cancelled", external_reference: o.id });
    expect("orden" in (await comprar(1))).toBe(true);
  });

  it("al cerrar la fiesta, los pagos sin cupo siguen pendientes de devolver", async () => {
    await updateTipo(ANTICIPADA, { cupo: 1 });
    const tarde = await comprarOk(1, "Llegó Tarde");
    minutos(RESERVA_MINUTOS + 1);
    const otra = await comprarOk(1);
    await approveOrden(otra.id);
    await processMpPayment({ id: 303, status: "approved", external_reference: tarde.id, transaction_amount: tarde.montoTotal });
    const sinPagar = await comprar(1);
    expect("error" in sinPagar).toBe(true); // agotada
    await cerrarEvento(FIESTA);
    expect((await getOrden(tarde.id))?.estado).toBe("pendiente");
    expect((await getOrden(tarde.id))?.problema).toBe("pago_sin_cupo");
  });
});

describe("pago que entra sin cupo", () => {
  async function escenarioSinCupo() {
    await updateTipo(ANTICIPADA, { cupo: 1 });
    const tarde = await comprarOk(1, "Llegó Tarde");
    minutos(RESERVA_MINUTOS + 1); // su reserva venció
    const otra = await comprarOk(1, "Pagó Primero");
    const ok = await approveOrden(otra.id);
    if ("error" in ok) throw new Error(ok.error);
    return tarde;
  }

  it("Mercado Pago: no emite entradas, marca la compra y avisa una sola vez", async () => {
    const tarde = await escenarioSinCupo();
    const pago = { id: 301, status: "approved", external_reference: tarde.id, transaction_amount: tarde.montoTotal };
    expect(await processMpPayment(pago)).toEqual({ ok: true });
    expect(await processMpPayment(pago)).toEqual({ ok: true }); // aviso repetido

    const final = await getOrden(tarde.id);
    expect(final?.estado).toBe("pendiente");
    expect(final?.problema).toBe("pago_sin_cupo");
    expect(await getTicketsByOrden(tarde.id)).toHaveLength(0);
    const avisos = (await getActivity()).filter((a) => a.mensaje.includes("PAGO SIN CUPO"));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].mensaje).toContain("Llegó Tarde");
  });

  it("Talo: igual que Mercado Pago", async () => {
    const tarde = await escenarioSinCupo();
    const pago = { id: "talo-sc", external_id: tarde.id, payment_status: "SUCCESS" } as PaymentResponse;
    expect(await processTaloPayment(pago)).toEqual({ ok: true });
    expect((await getOrden(tarde.id))?.problema).toBe("pago_sin_cupo");
  });

  it("al registrar la devolución, la compra queda devuelta y suma en reembolsado", async () => {
    const tarde = await escenarioSinCupo();
    await processMpPayment({ id: 302, status: "approved", external_reference: tarde.id, transaction_amount: tarde.montoTotal });
    const r = await cerrarPagoSinCupo(tarde.id);
    if ("error" in r) throw new Error(r.error);
    expect(r.orden.estado).toBe("reembolsado");
    const stats = await getAdminStats(FIESTA);
    expect(stats.reembolsado).toBe(tarde.montoTotal);
    expect(stats.vendidasActivas).toBe(1);
    // No se puede cerrar dos veces ni cerrar una compra normal.
    expect("error" in (await cerrarPagoSinCupo(tarde.id))).toBe(true);
  });
});

describe("link de Mercado Pago", () => {
  it("vence a los 10 minutos de la compra y no acepta pagos en proceso ni efectivo", () => {
    const o = orden({ estado: "pendiente", createdAt: T0.toISOString() });
    const body = preferenciaBody(o, evento(), "https://app.test", "https://app.test/api/webhook-mp", T0);
    expect(body.expires).toBe(true);
    expect(body.expiration_date_from).toBe("2026-11-20T12:00:00.000-03:00");
    expect(body.expiration_date_to).toBe("2026-11-20T12:10:00.000-03:00");
    expect(body.binary_mode).toBe(true);
    expect(body.payment_methods.excluded_payment_types.map((p) => p.id)).toEqual(["ticket", "atm"]);
    expect(body.items[0].unit_price).toBe(o.precioUnitario);
    expect(body).toMatchObject({ auto_return: "approved", notification_url: "https://app.test/api/webhook-mp" });
  });

  it("en pruebas locales no manda vuelta automática ni aviso (MP no llega a la PC)", () => {
    const o = orden({ createdAt: T0.toISOString() });
    const body = preferenciaBody(o, evento(), "http://localhost:3100", "http://localhost:3100/api/webhook-mp", T0);
    expect(body).not.toHaveProperty("auto_return");
    expect(body).not.toHaveProperty("notification_url");
    expect(body.back_urls.success).toContain("http://localhost:3100/compra/exito?orden=");
  });

  it("con token de prueba no manda el mail del comprador (MP lo rechaza si es una cuenta real)", () => {
    const o = orden({ createdAt: T0.toISOString(), compradorEmail: "real@gmail.com" });
    expect(preferenciaBody(o, evento(), "https://app.test", "https://app.test/w", T0)).toHaveProperty("payer.email", "real@gmail.com");
    expect(preferenciaBody(o, evento(), "https://app.test", "https://app.test/w", T0, { prueba: true })).not.toHaveProperty("payer");
  });

  it("fecha con hora de Argentina", () => {
    expect(isoArgentina(new Date("2026-11-20T15:30:00Z"))).toBe("2026-11-20T12:30:00.000-03:00");
  });
});

describe("Supabase de a páginas", () => {
  it("trae más de 1000 filas", async () => {
    const total = TAM_PAGINA * 2 + 345;
    const pedidos: [number, number][] = [];
    const filas = await traerTodo<number>(async (desde, hasta) => {
      pedidos.push([desde, hasta]);
      const data = Array.from({ length: Math.max(0, Math.min(hasta, total - 1) - desde + 1) }, (_, i) => desde + i);
      return { data, error: null };
    });
    expect(filas).toHaveLength(total);
    expect(new Set(filas).size).toBe(total);
    expect(pedidos).toHaveLength(3);
  });

  it("si una página falla, avisa en vez de contar de menos", async () => {
    await expect(traerTodo(async () => ({ data: null, error: { message: "timeout" } }))).rejects.toThrow("timeout");
  });

  it("un corte de red momentáneo se reintenta; un error de la consulta no", async () => {
    let intentos = 0;
    const filas = await traerTodo<number>(async () => {
      intentos++;
      return intentos === 1 ? { data: null, error: { message: "TypeError: fetch failed" } } : { data: [1, 2], error: null };
    });
    expect(filas).toEqual([1, 2]);
    expect(intentos).toBe(2);

    let pedidos = 0;
    await expect(
      traerTodo(async () => {
        pedidos++;
        return { data: null, error: { message: 'column "x" does not exist' } };
      })
    ).rejects.toThrow("does not exist");
    expect(pedidos).toBe(1);
  });
});

describe("tope de pedidos por IP", () => {
  it("bloquea al llegar al máximo y se libera al pasar la ventana", () => {
    const l = crearLimite(`test-${Math.random()}`, 3, 60_000);
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) l.sumar("1.2.3.4", t);
    expect(l.bloqueado("1.2.3.4", t)).toBe(true);
    expect(l.bloqueado("5.6.7.8", t)).toBe(false);
    expect(l.bloqueado("1.2.3.4", t + 61_000)).toBe(false);
  });
});
