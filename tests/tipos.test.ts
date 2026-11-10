import { describe, expect, it } from "vitest";
import {
  buildCatalogo,
  computeStats,
  evaluarTipos,
  fiestaEnProximamente,
  normalizarTipoInput,
  tipoParaPublico,
  uniqueSlug,
  validarCompraTipo,
  validarDatosComprador,
} from "@/lib/entradas/tipos";
import { AHORA, evento, orden, ticket, tipo } from "./helpers";

describe("evaluarTipos", () => {
  it("un tipo común está a la venta", () => {
    const [t] = evaluarTipos(evento(), [tipo()], [], AHORA);
    expect(t.fase).toBe("venta");
    expect(t.comprable).toBe(true);
    expect(t.disponibles).toBe(100);
  });

  it("el cupo del tipo y el aforo de la fiesta limitan lo disponible (las canceladas no cuentan)", () => {
    const vip = tipo({ id: "t-vip", estilo: "vip", cupo: 3 });
    const tickets = [
      ticket({ tipoEntradaId: "t-vip" }),
      ticket({ tipoEntradaId: "t-vip" }),
      ticket({ tipoEntradaId: "t-vip", cancelado: true }),
    ];
    const [t] = evaluarTipos(evento(), [vip], tickets, AHORA);
    expect(t.vendidas).toBe(2);
    expect(t.disponibles).toBe(1);

    const llena = evaluarTipos(evento({ capacidad: 2 }), [tipo()], tickets.slice(0, 2), AHORA)[0];
    expect(llena.fase).toBe("agotada");
    expect(llena.comprable).toBe(false);
  });

  it("después de 'venta hasta' queda cerrada", () => {
    const [t] = evaluarTipos(evento(), [tipo({ ventaHasta: "2026-11-15T23:59:00-03:00" })], [], AHORA);
    expect(t.fase).toBe("cerrada");
    expect(t.motivo).toBe("Cerró el 15/11");
  });

  it("con 'abre el' futura está en próximamente y abre sola al llegar la fecha", () => {
    const abre = "2026-11-27T23:59:00-03:00";
    const antes = evaluarTipos(evento(), [tipo({ ventaDesde: abre, proximamente: true })], [], AHORA)[0];
    expect(antes.fase).toBe("proximamente");
    expect(antes.abreEl).toBe(abre);
    expect(antes.comprable).toBe(false);

    const despues = evaluarTipos(evento(), [tipo({ ventaDesde: abre, proximamente: true })], [], new Date("2026-11-28T00:00:00-03:00"))[0];
    expect(despues.fase).toBe("venta");
    expect(despues.comprable).toBe(true);
  });

  it("próximamente sin fecha queda así hasta que el admin lo cambie", () => {
    const [t] = evaluarTipos(evento(), [tipo({ proximamente: true })], [], new Date("2027-01-01"));
    expect(t.fase).toBe("proximamente");
    expect(t.abreEl).toBeNull();
  });

  it("si la fiesta está en próximamente, ningún tipo se vende", () => {
    const ev = evento({ proximamente: true, ventaAbre: "2026-11-25T12:00:00-03:00" });
    expect(fiestaEnProximamente(ev, AHORA)).toBe(true);
    const tipos = evaluarTipos(ev, [tipo(), tipo({ id: "t2" })], [], AHORA);
    expect(tipos.every((t) => t.fase === "proximamente" && !t.comprable)).toBe(true);
    expect(fiestaEnProximamente(ev, new Date("2026-11-26"))).toBe(false);
  });

  it("pausada, finalizada o tipo inactivo no se venden", () => {
    expect(evaluarTipos(evento({ estado: "pausado" }), [tipo()], [], AHORA)[0].fase).toBe("pausada");
    expect(evaluarTipos(evento({ estado: "finalizado" }), [tipo()], [], AHORA)[0].comprable).toBe(false);
    expect(evaluarTipos(evento(), [tipo({ activo: false })], [], AHORA)[0].fase).toBe("oculto");
  });
});

describe("catálogo público", () => {
  it("en próximamente no viaja el precio ni lo disponible (salvo que el admin lo muestre)", () => {
    const [t] = evaluarTipos(evento(), [tipo({ proximamente: true, precio: 35000, cupo: 40 })], [], AHORA);
    const pub = tipoParaPublico(t);
    expect(pub.precio).toBe(0);
    expect(pub.cupo).toBeNull();
    expect(pub.disponibles).toBe(0);

    const [conPrecio] = evaluarTipos(evento(), [tipo({ proximamente: true, precio: 35000, mostrarPrecioPrevio: true })], [], AHORA);
    expect(tipoParaPublico(conPrecio).precio).toBe(35000);
  });

  it("'desde $' sale de lo que se puede comprar y no publica el precio viejo de la fiesta", () => {
    const tipos = [
      tipo({ id: "ant", estilo: "anticipada", precio: 15000, ventaHasta: "2026-11-27T23:59:00-03:00" }),
      tipo({ id: "gen", precio: 18000, proximamente: true }),
      tipo({ id: "vip", estilo: "vip", precio: 35000, proximamente: true }),
    ];
    const cat = buildCatalogo(evento(), tipos, [], AHORA);
    expect(cat.precioDesde).toBe(15000);
    expect(cat.hayProximos).toBe(true);
    expect(cat.proximamente).toBe(false);
    expect(cat.anticipadaHasta).toBe("2026-11-27T23:59:00-03:00");
    expect(cat.evento.precio).toBe(0);
    expect(JSON.stringify(cat)).not.toContain("18000");
    expect(JSON.stringify(cat)).not.toContain("35000");
  });

  it("si todos los tipos están en próximamente, la fiesta figura en próximamente y sin precio", () => {
    const cat = buildCatalogo(evento(), [tipo({ proximamente: true, ventaDesde: "2026-11-30T12:00:00-03:00" })], [], AHORA);
    expect(cat.proximamente).toBe(true);
    expect(cat.precioDesde).toBeNull();
    expect(cat.abreEl).toBe("2026-11-30T12:00:00-03:00");
  });
});

describe("validaciones de compra", () => {
  it("explica por qué no se puede comprar", () => {
    const [prox] = evaluarTipos(evento(), [tipo({ proximamente: true })], [], AHORA);
    expect(validarCompraTipo(prox, 1)).toBe("General: Próximamente");
    const [ok] = evaluarTipos(evento({ capacidad: 2 }), [tipo()], [], AHORA);
    expect(validarCompraTipo(ok, 3)).toBe("Solo quedan 2 entradas General");
    expect(validarCompraTipo(ok, 2)).toBeNull();
    expect(validarCompraTipo(undefined, 1)).toMatch(/no existe/);
  });

  it("pide nombre y un email válido", () => {
    expect(validarDatosComprador("Ana", "ana@test.com")).toBeNull();
    expect(validarDatosComprador("", "ana@test.com")).toMatch(/obligatorios/);
    expect(validarDatosComprador("Ana", "ana@test")).toMatch(/email/);
    expect(validarDatosComprador("Ana", "ana test@x.com")).toMatch(/email/);
  });

  it("normaliza lo que manda el admin", () => {
    const r = normalizarTipoInput({ nombre: " VIP ", precio: "35000.456", cupo: "", proximamente: true }, false);
    expect("value" in r && r.value).toMatchObject({ nombre: "VIP", precio: 35000.46, cupo: null, proximamente: true, mostrarPrecioPrevio: false });
    expect(normalizarTipoInput({ nombre: "X", precio: 0 }, false)).toEqual({ error: "El precio debe ser mayor a 0" });
    expect(
      normalizarTipoInput({ nombre: "X", precio: 1, ventaDesde: "2026-12-02", ventaHasta: "2026-12-01" }, false)
    ).toEqual({ error: "La apertura de la venta tiene que ser anterior al cierre" });
  });

  it("arma links únicos", () => {
    expect(uniqueSlug("Colegio Güemes", [])).toBe("colegio-guemes");
    expect(uniqueSlug("Colegio Güemes", ["colegio-guemes"])).toBe("colegio-guemes-2");
  });
});

describe("estadísticas", () => {
  it("lo recaudado es neto de lo devuelto en anulaciones", () => {
    const ordenes = [
      orden({ id: "a", montoTotal: 45000, precioUnitario: 15000, cantidad: 3, montoReembolsado: 15000 }),
      orden({ id: "b", montoTotal: 18000, estado: "reembolsado", montoReembolsado: 18000 }),
      orden({ id: "c", montoTotal: 18000, estado: "pendiente" }),
      // Reembolsada antes de existir las anulaciones parciales: cuenta completa.
      orden({ id: "d", montoTotal: 10000, estado: "reembolsado", montoReembolsado: 0 }),
    ];
    const tickets = [ticket(), ticket(), ticket({ usado: true }), ticket({ cancelado: true })];
    const s = computeStats({ capacidad: 100 }, [tipo()], ordenes, tickets);
    expect(s.reembolsado).toBe(15000 + 18000 + 10000);
    expect(s.recaudado).toBe(45000 - 15000);
    expect(s.vendidasActivas).toBe(3);
    expect(s.ingresaron).toBe(1);
    expect(s.canceladas).toBe(1);
    expect(s.totalOrdenes).toBe(1);
    expect(s.porTipo[0].recaudado).toBe(30000);
  });
});
