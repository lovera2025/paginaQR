export function formatPrecio(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

/** Cómo se puede pagar, según los medios que están activos ("mp" / "talo"). */
export function textoMedios(medios: string[]): string {
  if (medios.includes("mp") && medios.includes("talo")) return "Mercado Pago · transferencia · sin registro";
  if (medios.includes("mp")) return "Mercado Pago · sin registro";
  if (medios.includes("talo")) return "Transferencia · sin registro";
  return "Pago online · sin registro";
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

/** "VIE 4 DIC" */
export function diaCorto(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("es-AR", { weekday: "short", timeZone: TZ_AR }).replace(".", "");
  const num = d.toLocaleDateString("es-AR", { day: "numeric", timeZone: TZ_AR });
  const mes = d.toLocaleDateString("es-AR", { month: "short", timeZone: TZ_AR }).replace(".", "");
  return `${dia} ${num} ${mes}`.toUpperCase();
}

/** "22:00" */
export function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_AR,
  });
}

/** "27/11" */
export function ddmm(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: TZ_AR });
}

export function whatsappHref(phone: string | undefined | null, texto?: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export function instagramHref(user: string | undefined | null): string | null {
  const u = (user ?? "").replace(/^@/, "").trim();
  return u ? `https://instagram.com/${u}` : null;
}

export function ticketEstadoLabel(ticket: {
  cancelado: boolean;
  usado: boolean;
  reembolsado?: boolean;
  motivoCancelacion?: string | null;
}): string {
  if (ticket.cancelado) {
    if (ticket.reembolsado) return "Anulada (devuelta)";
    if (ticket.motivoCancelacion?.startsWith("Anulación")) return "Anulada";
    return "Dada de baja";
  }
  if (ticket.usado) return "Ya ingresó";
  return "Sin usar";
}
