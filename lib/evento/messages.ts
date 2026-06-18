import type { Evento } from "@/types";

export const DEFAULT_MENSAJE_POSTERGADO =
  "El evento fue postergado. Las ventas están detenidas por el momento. Si ya compraste, contactá al organizador para la devolución.";

export function getMensajePostergado(
  evento: Pick<Evento, "mensajePostergado">
): string {
  const custom = evento.mensajePostergado?.trim();
  return custom || DEFAULT_MENSAJE_POSTERGADO;
}
