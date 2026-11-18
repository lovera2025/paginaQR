/**
 * DNI y fecha de nacimiento del comprador: se piden al comprar y, juntos, sirven para
 * "Recuperar mis entradas" desde la web (sin mail).
 */

/** Solo los números del DNI (saca puntos, espacios y guiones). */
export function limpiarDni(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** DNI válido: de 6 a 8 números (los muy viejos, LE/LC, tienen menos de 7). Devuelve null si no sirve. */
export function normalizarDni(raw: unknown): string | null {
  const dni = limpiarDni(raw).replace(/^0+/, "");
  return /^\d{6,8}$/.test(dni) ? dni : null;
}

/** Hoy en Argentina como AAAA-MM-DD. */
function hoyArgentina(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Fecha de nacimiento como AAAA-MM-DD, o null si no existe (31/02), está en el futuro o es anterior a 1920.
 * Acepta "AAAA-MM-DD" o las partes { dia, mes, anio }.
 */
export function normalizarNacimiento(
  raw: unknown,
  now: Date = new Date()
): string | null {
  let anio: number, mes: number, dia: number;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    anio = Number(r.anio);
    mes = Number(r.mes);
    dia = Number(r.dia);
  } else {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(raw ?? "").trim());
    if (!m) return null;
    anio = Number(m[1]);
    mes = Number(m[2]);
    dia = Number(m[3]);
  }
  if (![anio, mes, dia].every(Number.isInteger)) return null;
  if (anio < 1920 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  const iso = d.toISOString().slice(0, 10);
  if (iso > hoyArgentina(now)) return null;
  return iso;
}

/** Mensaje para el comprador si el DNI o la fecha no sirven; null si están bien. */
export function validarIdentidad(dni: unknown, nacimiento: unknown): string | null {
  if (!normalizarDni(dni)) return "Revisá el DNI: tienen que ser solo los números (7 u 8)";
  if (!normalizarNacimiento(nacimiento)) return "Revisá la fecha de nacimiento";
  return null;
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
