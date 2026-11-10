import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abrirVentaPublicadas,
  approveOrden,
  createOrdenPendiente,
  getEventoById,
  getEventoCatalogo,
  getEventosAdmin,
  getOrden,
  getTipoById,
  getTiposByEvento,
  updateEvento,
  updateTipo,
  updateTipoEnOtrasFiestas,
} from "@/lib/db";
import { buildCatalogo } from "@/lib/entradas/tipos";
import { comprasACsv } from "@/lib/exportar";
import { calcularModoPagos, cobraDeVerdad } from "@/lib/payments/modo";
import type { PaymentSettings } from "@/lib/payments/settings";
import { AHORA, evento, orden, tipo } from "./helpers";

const FIESTA = "rec-pinaroli";
const ANTICIPADA = `${FIESTA}-anticipada`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T12:00:00-03:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

async function anticipadas() {
  const eventos = await getEventosAdmin();
  const tipos = await Promise.all(eventos.map((e) => getTiposByEvento(e.id)));
  return tipos.flat().filter((t) => t.estilo === "anticipada");
}

describe("aplicar un cambio a todas las fiestas", () => {
  it("el precio nuevo de la Anticipada llega a las 9 fiestas y no toca General ni VIP", async () => {
    const base = (await getTipoById(ANTICIPADA))!;
    await updateTipo(ANTICIPADA, { precio: 10000 });
    const r = await updateTipoEnOtrasFiestas(base, { precio: 10000 });
    expect(r).toEqual({ actualizadas: 8, omitidas: [] });

    const todas = await anticipadas();
    expect(todas).toHaveLength(9);
    expect(todas.every((t) => t.precio === 10000)).toBe(true);

    const general = (await getTipoById("rec-la-rotonda-general"))!;
    const vip = (await getTipoById("rec-la-rotonda-vip"))!;
    expect(general.precio).toBe(18000);
    expect(vip.precio).toBe(35000);
  });

  it("solo viajan precio y apertura/cierre: cupo, nombre y textos de las otras fiestas no cambian", async () => {
    const base = (await getTipoById(ANTICIPADA))!;
    const r = await updateTipoEnOtrasFiestas(base, { cupo: 5, descripcion: "otra", nombre: "Preventa", activo: false });
    expect(r.actualizadas).toBe(0);
    const otra = (await getTipoById("rec-torrent-anticipada"))!;
    expect(otra.cupo).toBe(150);
    expect(otra.nombre).toBe("Anticipada");
    expect(otra.activo).toBe(true);
  });

  it("abrir la General ahora en todas la deja a la venta en todas", async () => {
    const base = (await getTipoById(`${FIESTA}-general`))!;
    const cambio = { proximamente: false, ventaDesde: null };
    await updateTipo(base.id, cambio);
    const r = await updateTipoEnOtrasFiestas(base, cambio);
    expect(r.actualizadas).toBe(8);
    const cat = await getEventoCatalogo("rec-torrent");
    expect(cat?.tipos.find((t) => t.estilo === "general")?.comprable).toBe(true);
  });

  it("si la fecha no cierra en una fiesta, esa se saltea y se avisa cuál", async () => {
    // En Torrent la Anticipada ya tiene una fecha de apertura posterior al cierre que se quiere aplicar.
    await updateTipo("rec-torrent-anticipada", { ventaDesde: "2026-11-25T00:00:00-03:00", ventaHasta: "2026-12-10T00:00:00-03:00" });
    const base = (await getTipoById(ANTICIPADA))!;
    const r = await updateTipoEnOtrasFiestas(base, { ventaHasta: "2026-11-21T00:00:00-03:00" });
    expect(r.actualizadas).toBe(7);
    expect(r.omitidas).toHaveLength(1);
    expect(r.omitidas[0]).toContain("Torrent");
  });

  it("una compra ya hecha mantiene el precio que pagó", async () => {
    const c = await createOrdenPendiente({
      eventoId: "rec-torrent",
      tipoEntradaId: "rec-torrent-anticipada",
      compradorNombre: "Ana",
      compradorEmail: "ana@example.com",
      cantidad: 2,
    });
    if ("error" in c) throw new Error(c.error);
    await approveOrden(c.orden.id);

    const base = (await getTipoById(ANTICIPADA))!;
    await updateTipoEnOtrasFiestas(base, { precio: 10000 });
    const final = await getOrden(c.orden.id);
    expect(final?.precioUnitario).toBe(15000);
    expect(final?.montoTotal).toBe(30000);
  });
});

describe("abrir la venta de las fiestas publicadas", () => {
  it("saca de Próximamente solo a las publicadas; el borrador no se toca", async () => {
    for (const e of await getEventosAdmin()) await updateEvento(e.id, { proximamente: true, ventaAbre: null });
    const antes = await getEventoCatalogo(FIESTA);
    expect(antes?.proximamente).toBe(true);

    const r = await abrirVentaPublicadas();
    expect(r.abiertas).toHaveLength(8);
    expect((await getEventoById(FIESTA))?.proximamente).toBe(false);
    expect((await getEventoById("rec-mariano-loza"))?.proximamente).toBe(true);

    // Al abrir la fiesta, cada tipo sigue con su propia etapa: Anticipada vende, General y VIP esperan.
    const cat = await getEventoCatalogo(FIESTA);
    expect(cat?.proximamente).toBe(false);
    expect(cat?.tipos.find((t) => t.estilo === "anticipada")?.comprable).toBe(true);
    expect(cat?.tipos.find((t) => t.estilo === "vip")?.comprable).toBe(false);
  });

  it("solo se considera cobro real con un medio activo que no sea de prueba", () => {
    const settings = (mp: Partial<PaymentSettings["mp"]>): PaymentSettings => ({
      mp: { accessToken: "APP_USR-x", environment: "production", enabled: true, storedInDb: true, ...mp },
      talo: { userId: "", clientId: "", clientSecret: "", environment: "production", enabled: true, storedInDb: true },
    });
    expect(cobraDeVerdad(calcularModoPagos(settings({}), "production"))).toBe(true);
    expect(cobraDeVerdad(calcularModoPagos(settings({ environment: "sandbox" }), "production"))).toBe(false);
    expect(cobraDeVerdad(calcularModoPagos(settings({ enabled: false }), "production"))).toBe(false);
    expect(cobraDeVerdad(calcularModoPagos(settings({ accessToken: "" }), "production"))).toBe(false);
    // Sin medios en la compu de prueba el pago se simula: tampoco es cobro real.
    expect(cobraDeVerdad(calcularModoPagos(settings({ accessToken: "" }), "mock"))).toBe(false);
  });
});

describe("precio anticipado en Próximamente", () => {
  it("la fiesta en Próximamente muestra 'desde' solo si un tipo eligió mostrar su precio", () => {
    const ev = evento({ proximamente: true, ventaAbre: null });
    const oculto = buildCatalogo(ev, [tipo({ id: "a", estilo: "anticipada", precio: 10000 })], [], AHORA);
    expect(oculto.proximamente).toBe(true);
    expect(oculto.precioDesde).toBeNull();
    expect(oculto.tipos[0].precio).toBe(0);

    const visible = buildCatalogo(
      ev,
      [tipo({ id: "a", estilo: "anticipada", precio: 10000, mostrarPrecioPrevio: true }), tipo({ id: "g", precio: 18000 })],
      [],
      AHORA
    );
    expect(visible.precioDesde).toBe(10000);
    expect(visible.tipos.find((t) => t.id === "a")?.precio).toBe(10000);
    // El precio del tipo que no lo muestra sigue sin viajar.
    expect(visible.tipos.find((t) => t.id === "g")?.precio).toBe(0);
    expect(visible.tipos.every((t) => !t.comprable)).toBe(true);
  });
});

describe("descargar compras", () => {
  it("arma un archivo que Excel abre bien y no ejecuta fórmulas", () => {
    const csv = comprasACsv([
      { evento: { nombre: 'Colegio "Torrent"' }, orden: orden({ id: "abcdef12-0000", compradorNombre: "=HYPERLINK(1)", compradorEmail: "a;b@x.com", paymentMethod: "mp", paymentId: "123" }) },
      { evento: { nombre: "Otra" }, orden: orden({ id: "99999999-0000", estado: "pendiente", problema: "pago_sin_cupo", modoPago: null }) },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lineas = csv.trim().split("\r\n");
    expect(lineas).toHaveLength(3);
    expect(lineas[0]).toContain("Comprador;Email");
    expect(lineas[1]).toContain('"Colegio ""Torrent"""');
    expect(lineas[1]).toContain("'=HYPERLINK(1)");
    expect(lineas[1]).toContain('"a;b@x.com"');
    expect(lineas[1]).toContain("Pagada;Mercado Pago;123;Real;abcdef12");
    expect(lineas[2]).toContain("Pago sin cupo: devolver");
  });
});
