type Pagina = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/** Máximo de filas que devuelve Supabase por pedido (configuración por defecto del proyecto). */
export const TAM_PAGINA = 1000;

/**
 * Supabase devuelve como máximo 1000 filas por pedido y corta sin avisar.
 * Trae todas de a páginas (el pedido tiene que tener un orden estable, ej. por id).
 * Si falla, tira error: contar de menos haría vender entradas que no hay.
 */
export async function traerTodo<T>(pedir: (desde: number, hasta: number) => Pagina): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await pedir(desde, desde + TAM_PAGINA - 1);
    if (error) throw new Error(`Supabase: ${error.message}`);
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length < TAM_PAGINA) return filas;
  }
}
