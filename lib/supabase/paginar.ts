type Pagina = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/** Máximo de filas que devuelve Supabase por pedido (configuración por defecto del proyecto). */
export const TAM_PAGINA = 1000;

/** Cortes de red momentáneos (no errores de la consulta): vale la pena reintentar. */
const ERROR_DE_RED = /fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|other side closed/i;
const ESPERAS_REINTENTO_MS = [300, 1000];

/** Pide una página; si se cortó la red, reintenta dos veces (es una lectura, se puede repetir). */
async function pedirConReintento(pedir: () => Pagina) {
  for (let intento = 0; ; intento++) {
    const r = await pedir();
    const espera = ESPERAS_REINTENTO_MS[intento];
    if (!r.error || !ERROR_DE_RED.test(r.error.message) || espera === undefined) return r;
    await new Promise((ok) => setTimeout(ok, espera));
  }
}

/**
 * Supabase devuelve como máximo 1000 filas por pedido y corta sin avisar.
 * Trae todas de a páginas (el pedido tiene que tener un orden estable, ej. por id).
 * Si falla, tira error: contar de menos haría vender entradas que no hay.
 */
export async function traerTodo<T>(pedir: (desde: number, hasta: number) => Pagina): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await pedirConReintento(() => pedir(desde, desde + TAM_PAGINA - 1));
    if (error) throw new Error(`Supabase: ${error.message}`);
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length < TAM_PAGINA) return filas;
  }
}
