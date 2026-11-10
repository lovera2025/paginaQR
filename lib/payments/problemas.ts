import { marcarProblemaOrden, registrarActividad } from "@/lib/db";
import { formatPrecio } from "@/lib/utils";
import type { Orden } from "@/types";

/**
 * El pago entró pero ya no quedaban entradas (se vendieron mientras la persona pagaba).
 * No se emiten entradas: la compra queda marcada para devolver la plata y se avisa en Actividad
 * una sola vez (los avisos repetidos del medio de pago no duplican el registro).
 */
export async function registrarPagoSinCupo(orden: Orden, ref: string, motivo: string): Promise<void> {
  const r = await marcarProblemaOrden(orden.id, "pago_sin_cupo");
  if ("error" in r) {
    console.error("[PAGO SIN CUPO] no se pudo marcar la compra:", orden.id, r.error);
  } else if (!r.nuevo) {
    return;
  }
  await registrarActividad(
    "pago",
    `${ref} → ATENCIÓN, PAGO SIN CUPO (${motivo}): ${orden.compradorNombre} pagó ${formatPrecio(orden.montoTotal)} y no quedaban entradas. Hay que devolverle la plata (${orden.compradorEmail}).`
  );
}
