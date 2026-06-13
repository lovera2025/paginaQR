export function formatPrecio(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

const TZ_AR = "America/Argentina/Buenos_Aires";

export function formatFecha(iso: string): string {
  const d = new Date(iso);
  const weekdayRaw = d.toLocaleDateString("es-AR", {
    weekday: "long",
    timeZone: TZ_AR,
  });
  const day = d.toLocaleDateString("es-AR", {
    day: "numeric",
    timeZone: TZ_AR,
  });
  const month = d.toLocaleDateString("es-AR", {
    month: "long",
    timeZone: TZ_AR,
  });
  const hora = d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_AR,
  });
  const weekday =
    weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  return `${weekday} ${day} de ${month} · ${hora} hs`;
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
