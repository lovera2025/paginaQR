/**
 * Compras aprobadas guardadas en el dispositivo (localStorage) para encontrar las entradas otra vez
 * sin mail ni cuenta. Solo las ve quien compró desde ese mismo celular o computadora (y navegador).
 */
const CLAVE = "je_mis_entradas_v1";
const MAXIMO = 30;

export interface CompraGuardada {
  ordenId: string;
  evento: string;
  fecha: string | null;
  tipo: string;
  cantidad: number;
  guardadaEl: string;
}

function esCompra(x: unknown): x is CompraGuardada {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  return typeof c.ordenId === "string" && typeof c.evento === "string" && typeof c.cantidad === "number";
}

export function leerComprasGuardadas(): CompraGuardada[] {
  try {
    const crudo = JSON.parse(window.localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(crudo) ? crudo.filter(esCompra) : [];
  } catch {
    return [];
  }
}

export function guardarCompra(compra: Omit<CompraGuardada, "guardadaEl">): void {
  try {
    const resto = leerComprasGuardadas().filter((c) => c.ordenId !== compra.ordenId);
    const lista = [{ ...compra, guardadaEl: new Date().toISOString() }, ...resto].slice(0, MAXIMO);
    window.localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Navegador privado o sin espacio: no se guarda (la pantalla y el PDF siguen andando).
  }
}

export function olvidarCompra(ordenId: string): void {
  try {
    const lista = leerComprasGuardadas().filter((c) => c.ordenId !== ordenId);
    window.localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* nada */
  }
}
