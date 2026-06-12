export function formatPrecio(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

const TZ_AR = "America/Argentina/Buenos_Aires";

export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_AR,
  });
}

/** Para input datetime-local: hora Argentina (YYYY-MM-DDTHH:mm). */
export function isoToDatetimeLocalAr(iso: string): string {
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: TZ_AR })
    .replace(" ", "T")
    .slice(0, 16);
}

export function formatFechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_AR,
  });
}

export function ticketEstadoLabel(ticket: {
  cancelado: boolean;
  usado: boolean;
}): string {
  if (ticket.cancelado) return "Cancelada";
  if (ticket.usado) return "Ya ingresó";
  return "Sin usar";
}
