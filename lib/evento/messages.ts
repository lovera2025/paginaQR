import type { Evento } from "@/types";

export const DEFAULT_MENSAJE_POSTERGADO =
  "El evento fue postergado. Las ventas están detenidas por el momento. Si ya compraste, contactá al organizador para la devolución.";

export function getMensajePostergado(
  evento: Pick<Evento, "mensajePostergado">
): string {
  const custom = evento.mensajePostergado?.trim();
  return custom || DEFAULT_MENSAJE_POSTERGADO;
}

/** Texto estándar mientras la fiesta está en "Próximamente" y todavía no hay fecha de apertura. */
export const DEFAULT_MENSAJE_PROXIMAMENTE = "Las entradas salen muy pronto. Volvé a entrar en unos días para comprar la tuya.";

/** Lo que escribió el organizador para "Próximamente", o null si usa el texto estándar. */
export function getMensajeProximamente(evento: Pick<Evento, "mensajeProximamente">): string | null {
  return evento.mensajeProximamente?.trim() || null;
}
