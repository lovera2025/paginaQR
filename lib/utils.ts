export function formatPrecio(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
