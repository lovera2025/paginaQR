import type { Orden, Ticket } from "@/types";

/** Motivos sugeridos en el panel (también se puede escribir otro). */
export const MOTIVOS_ANULACION = [
  "Pidió el comprador por WhatsApp",
  "Fiesta postergada o cancelada",
  "Error en la compra",
] as const;

/**
 * Valida qué entradas de una compra se pueden anular y calcula la plata a devolver
 * con el precio congelado de esa compra.
 */
export function prepararAnulacion(
  orden: Pick<Orden, "id" | "precioUnitario">,
  tickets: Ticket[],
  ticketIds: string[]
): { tickets: Ticket[]; monto: number } | { error: string } {
  const ids = Array.from(new Set(ticketIds.map((id) => String(id).trim()).filter(Boolean)));
  if (ids.length === 0) return { error: "Elegí al menos una entrada" };

  const elegidas: Ticket[] = [];
  for (const id of ids) {
    const t = tickets.find((x) => x.id === id);
    if (!t || t.ordenId !== orden.id) return { error: "Una de las entradas no es de esta compra" };
    if (t.cancelado) return { error: `La entrada ${t.numeroEntrada} ya está anulada` };
    if (t.usado) return { error: `La entrada ${t.numeroEntrada} ya ingresó a la fiesta: no se puede anular` };
    elegidas.push(t);
  }

  const monto = Math.round(elegidas.length * orden.precioUnitario * 100) / 100;
  return { tickets: elegidas, monto };
}

/** Texto para la puerta cuando el QR está cancelado. */
export function mensajeCancelada(ticket: Pick<Ticket, "motivoCancelacion" | "reembolsado">): string {
  const motivo = ticket.motivoCancelacion?.replace(/^Anulación:\s*/, "").trim();
  const base = ticket.reembolsado || ticket.motivoCancelacion?.startsWith("Anulación") ? "Entrada anulada" : "Entrada cancelada";
  return motivo ? `${base} · ${motivo}` : base;
}

export function textoAnulacion(
  slug: string,
  orden: Pick<Orden, "compradorNombre" | "tipoNombre">,
  cantidad: number,
  monto: number,
  motivo: string
): string {
  const devolucion = monto > 0 ? `, devuelto $${monto.toLocaleString("es-AR")}` : " (sin devolución)";
  return `Anulación ${slug}: ${orden.compradorNombre}, ${cantidad} × ${orden.tipoNombre}${devolucion} · ${motivo}`;
}
