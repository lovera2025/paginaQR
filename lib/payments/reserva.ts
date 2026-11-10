import { linkPagoVenceEl } from "@/lib/entradas/tipos";
import type { Orden } from "@/types";

export const MENSAJE_RESERVA_VENCIDA =
  "Pasó el tiempo para pagar y las entradas se liberaron. Volvé a elegirlas: si quedan, las podés comprar de nuevo.";

/** Una compra sin pagar solo se puede empezar a pagar dentro de los minutos de reserva. */
export function reservaVencida(orden: Pick<Orden, "createdAt">, now: Date = new Date()): boolean {
  return now > linkPagoVenceEl(orden);
}
