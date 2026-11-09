import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  anularTickets,
  approveOrden,
  createOrdenPendiente,
  getAdminStats,
  getEventoCatalogo,
  getOrden,
  getTicketsByOrden,
  getTiposByEvento,
  rejectOrden,
  updateEvento,
  updateTipo,
  verifyTicket,
} from "@/lib/db";

// La base de prueba trae 9 fiestas: en cada una Anticipada a la venta (cupo 150, hasta 7 días antes),
// General "próximamente" (abre cuando cierra la anticipada) y VIP "fecha a confirmar" (cupo 40).
const FIESTA = "rec-pinaroli";
const OTRA = "rec-la-rotonda";
const ANTICIPADA = `${FIESTA}-anticipada`;
const GENERAL = `${FIESTA}-general`;
const VIP = `${FIESTA}-vip`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T12:00:00-03:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

async function comprar(tipoEntradaId: string, cantidad: number, eventoId = FIESTA) {
  const r = await createOrdenPendiente({
    eventoId,
    tipoEntradaId,
    compradorNombre: "Lucía Prueba",
    compradorEmail: "LUCIA@Example.com",
    cantidad,
  });
  if ("error" in r) throw new Error(r.error);
  return r.orden;
}

describe("compra → pago aprobado → entradas", () => {
  it("las entradas existen solo después de aprobar el pago, una por persona", async () => {
    const orden = await comprar(ANTICIPADA, 3);
    expect(orden.estado).toBe("pendiente");
    expect(orden.compradorEmail).toBe("lucia@example.com");
    expect(orden.montoTotal).toBe(45000);
    expect(await getTicketsByOrden(orden.id)).toHaveLength(0);

    const r = await approveOrden(orden.id);
    if ("error" in r) throw new Error(r.error);
    expect(r.orden.estado).toBe("aprobado");
    expect(r.orden.modoPago).toBe("simulado");
    expect(r.tickets).toHaveLength(3);
    expect(r.tickets.map((t) => t.numeroEntrada).sort()).toEqual([1, 2, 3]);
    expect(new Set(r.tickets.map((t) => t.id)).size).toBe(3);

    // Aprobar dos veces (webhook + vuelta del pago) no duplica entradas.
    const again = await approveOrden(orden.id);
    if ("error" in again) throw new Error(again.error);
    expect(again.nueva).toBe(false);
    expect(await getTicketsByOrden(orden.id)).toHaveLength(3);
  });

  it("un pago rechazado no genera entradas y no se puede aprobar después", async () => {
    const orden = await comprar(ANTICIPADA, 1);
    expect("orden" in (await rejectOrden(orden.id))).toBe(true);
    expect(await approveOrden(orden.id)).toEqual({ error: "Orden no está pendiente" });
    expect(await getTicketsByOrden(orden.id)).toHaveLength(0);
  });

  it("el precio queda congelado aunque el admin lo cambie después", async () => {
    const orden = await comprar(ANTICIPADA, 2);
    await updateTipo(ANTICIPADA, { precio: 99999 });
    await approveOrden(orden.id);
    const final = await getOrden(orden.id);
    expect(final?.montoTotal).toBe(30000);
    expect(final?.precioUnitario).toBe(15000);
  });

  it("respeta el cupo del tipo al crear la compra y al aprobarla", async () => {
    await updateTipo(ANTICIPADA, { cupo: 3 });
    const r = await createOrdenPendiente({
      eventoId: FIESTA,
      tipoEntradaId: ANTICIPADA,
      compradorNombre: "A",
      compradorEmail: "a@a.com",
      cantidad: 4,
    });
    expect(r).toEqual({ error: "Solo quedan 3 entradas Anticipada" });

    // Dos compras pendientes a la vez que juntas pasan el cupo: la segunda no se aprueba.
    const a = await comprar(ANTICIPADA, 2);
    const b = await comprar(ANTICIPADA, 2);
    expect("orden" in (await approveOrden(a.id))).toBe(true);
    expect(await approveOrden(b.id)).toEqual({ error: "Cupo Anticipada agotado" });
  });

  it("no deja comprar tipos ni fiestas en próximamente", async () => {
    await expect(comprar(GENERAL, 1)).rejects.toThrow("General: Próximamente");
    await expect(comprar(VIP, 1)).rejects.toThrow("VIP: Próximamente");

    await updateEvento(FIESTA, { proximamente: true, ventaAbre: null });
    await expect(comprar(ANTICIPADA, 1)).rejects.toThrow("todavía no abrió");
    const cat = await getEventoCatalogo(FIESTA);
    expect(cat?.proximamente).toBe(true);
    expect(cat?.precioDesde).toBeNull();
  });

  it("la General abre sola cuando cierra la anticipada", async () => {
    const general = (await getTiposByEvento(FIESTA)).find((t) => t.id === GENERAL)!;
    vi.setSystemTime(new Date(new Date(general.ventaDesde!).getTime() + 60_000));
    const orden = await comprar(GENERAL, 1);
    expect(orden.precioUnitario).toBe(18000);
    await expect(comprar(ANTICIPADA, 1)).rejects.toThrow(/Anticipada: Cerró el/);
  });
});

describe("puerta", () => {
  it("válida una sola vez, avisa si es de otra fiesta y marca las de prueba", async () => {
    const orden = await comprar(ANTICIPADA, 2);
    const r = await approveOrden(orden.id);
    if ("error" in r) throw new Error(r.error);
    const [t1, t2] = r.tickets;

    const ok = await verifyTicket(t1.id, FIESTA);
    expect(ok.status).toBe("valido");
    expect(ok.prueba).toBe(true);
    expect((await verifyTicket(t1.id, FIESTA)).status).toBe("usada");

    const otra = await verifyTicket(t2.id, OTRA);
    expect(otra.status).toBe("otro_evento");
    // En otra fiesta no se gasta.
    expect((await verifyTicket(t2.id, FIESTA)).status).toBe("valido");

    expect((await verifyTicket("no-existe", FIESTA)).status).toBe("invalido");
  });
});

describe("anulaciones a mano", () => {
  it("anula por entrada, registra lo devuelto, libera el cupo y el QR deja de valer", async () => {
    const orden = await comprar(ANTICIPADA, 3);
    const r = await approveOrden(orden.id);
    if ("error" in r) throw new Error(r.error);
    const [t1, t2, t3] = r.tickets;
    await verifyTicket(t1.id, FIESTA);

    expect(
      await anularTickets({ ordenId: orden.id, ticketIds: [t1.id], motivo: "Pidió el comprador", devolverPlata: true })
    ).toEqual({ error: "La entrada 1 ya ingresó a la fiesta: no se puede anular" });
    expect(
      await anularTickets({ ordenId: orden.id, ticketIds: [t2.id], motivo: " ", devolverPlata: true })
    ).toEqual({ error: "Elegí el motivo de la anulación" });

    const antes = (await getEventoCatalogo(FIESTA))!.tipos.find((t) => t.id === ANTICIPADA)!.disponibles;
    const a = await anularTickets({ ordenId: orden.id, ticketIds: [t2.id], motivo: "Pidió el comprador", devolverPlata: true });
    if ("error" in a) throw new Error(a.error);
    expect(a.monto).toBe(15000);
    expect(a.orden.estado).toBe("aprobado");
    expect(a.orden.montoReembolsado).toBe(15000);

    const despues = (await getEventoCatalogo(FIESTA))!.tipos.find((t) => t.id === ANTICIPADA)!.disponibles;
    expect(despues).toBe(antes + 1);

    const puerta = await verifyTicket(t2.id, FIESTA);
    expect(puerta.status).toBe("cancelada");
    expect(puerta.message).toBe("Entrada anulada · Pidió el comprador");

    // Sin devolver plata: queda como baja, no suma a lo devuelto.
    const b = await anularTickets({ ordenId: orden.id, ticketIds: [t3.id], motivo: "Error en la compra", devolverPlata: false });
    if ("error" in b) throw new Error(b.error);
    expect(b.monto).toBe(0);
    expect(b.orden.montoReembolsado).toBe(15000);

    const stats = await getAdminStats(FIESTA);
    expect(stats.reembolsado).toBe(15000);
    expect(stats.recaudado).toBe(30000);
    expect(stats.vendidasActivas).toBe(1);
  });

  it("si se anulan todas con devolución, la compra queda anulada", async () => {
    const orden = await comprar(ANTICIPADA, 2);
    const r = await approveOrden(orden.id);
    if ("error" in r) throw new Error(r.error);
    const a = await anularTickets({
      ordenId: orden.id,
      ticketIds: r.tickets.map((t) => t.id),
      motivo: "Fiesta postergada o cancelada",
      devolverPlata: true,
    });
    if ("error" in a) throw new Error(a.error);
    expect(a.orden.estado).toBe("reembolsado");
    expect(a.monto).toBe(30000);
    // Ya no se puede volver a anular.
    expect("error" in (await anularTickets({ ordenId: orden.id, ticketIds: [r.tickets[0].id], motivo: "x", devolverPlata: true }))).toBe(true);
  });

  it("no anula entradas de otra compra ni compras sin pagar", async () => {
    const a = await comprar(ANTICIPADA, 1);
    const b = await comprar(ANTICIPADA, 1);
    const ra = await approveOrden(a.id);
    if ("error" in ra) throw new Error(ra.error);
    expect(await anularTickets({ ordenId: b.id, ticketIds: [ra.tickets[0].id], motivo: "x", devolverPlata: true })).toEqual({
      error: "Solo se pueden anular compras con pago aprobado",
    });
    await approveOrden(b.id);
    expect(await anularTickets({ ordenId: b.id, ticketIds: [ra.tickets[0].id], motivo: "x", devolverPlata: true })).toEqual({
      error: "Una de las entradas no es de esta compra",
    });
  });
});
