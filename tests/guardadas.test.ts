import { beforeEach, describe, expect, it } from "vitest";
import { guardarCompra, leerComprasGuardadas, olvidarCompra } from "@/lib/entradas/guardadas";

// localStorage mínimo (los tests corren sin navegador).
const datos = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  },
};

const compra = (n: number) => ({ ordenId: `orden-${n}`, evento: "Fiesta", fecha: null, tipo: "Anticipada", cantidad: 2 });

describe("Mis entradas guardadas en el dispositivo", () => {
  beforeEach(() => datos.clear());

  it("guarda la última primero y no repite la misma compra", () => {
    guardarCompra(compra(1));
    guardarCompra(compra(2));
    guardarCompra(compra(1));
    expect(leerComprasGuardadas().map((c) => c.ordenId)).toEqual(["orden-1", "orden-2"]);
  });

  it("guarda como máximo 30", () => {
    for (let i = 0; i < 35; i++) guardarCompra(compra(i));
    const lista = leerComprasGuardadas();
    expect(lista).toHaveLength(30);
    expect(lista[0].ordenId).toBe("orden-34");
  });

  it("si lo guardado está roto, devuelve vacío sin romper", () => {
    datos.set("je_mis_entradas_v1", "{no es json");
    expect(leerComprasGuardadas()).toEqual([]);
    datos.set("je_mis_entradas_v1", JSON.stringify([{ basura: true }, compra(7)]));
    expect(leerComprasGuardadas().map((c) => c.ordenId)).toEqual(["orden-7"]);
  });

  it("se puede olvidar una compra", () => {
    guardarCompra(compra(1));
    guardarCompra(compra(2));
    olvidarCompra("orden-1");
    expect(leerComprasGuardadas().map((c) => c.ordenId)).toEqual(["orden-2"]);
  });
});
