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

// Dominios de mail más usados acá: si escribieron algo parecido, se sugiere el correcto.
const DOMINIOS_COMUNES = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.ar",
  "outlook.com",
  "outlook.com.ar",
  "yahoo.com",
  "yahoo.com.ar",
  "live.com",
  "live.com.ar",
  "icloud.com",
];
// Dominios reales que se parecen a uno común: no se "corrigen".
const DOMINIOS_VALIDOS = new Set([
  ...DOMINIOS_COMUNES,
  "ymail.com",
  "mail.com",
  "email.com",
  "gmx.com",
  "me.com",
  "mac.com",
  "aol.com",
  "msn.com",
  "proton.me",
  "protonmail.com",
  "hotmail.es",
  "outlook.es",
  "yahoo.es",
  "live.com.mx",
  "hotmail.com.mx",
]);
// Errores que no son de tipeo sino de costumbre.
const DOMINIOS_EQUIVOCADOS: Record<string, string> = {
  "gmail.com.ar": "gmail.com",
  "gmail.ar": "gmail.com",
  "icloud.com.ar": "icloud.com",
};

/** Distancia entre dos textos contando letras cambiadas, de más, de menos o dadas vuelta. */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Si el mail parece mal escrito ("juan@gmial.con"), devuelve cómo debería ser ("juan@gmail.com").
 * Si está bien o no se puede saber, devuelve null.
 */
export function sugerirEmail(email: string): string | null {
  const limpio = email.trim().toLowerCase();
  const arroba = limpio.lastIndexOf("@");
  if (arroba < 1 || arroba === limpio.length - 1) return null;
  const usuario = limpio.slice(0, arroba);
  const original = limpio.slice(arroba + 1);
  if (DOMINIOS_VALIDOS.has(original)) return null;

  let dominio = original.replace(/,/g, ".").replace(/\s+/g, "").replace(/\.+$/, "");
  dominio = dominio
    .replace(/\.(con|cmo|cpm|cim|vom|xom|comm|coom|ocm)(\.ar)?$/, ".com$2")
    .replace(/\.(arg|ra)$/, ".ar");

  let sugerido: string | null = DOMINIOS_EQUIVOCADOS[dominio] ?? null;
  if (!sugerido && DOMINIOS_VALIDOS.has(dominio)) sugerido = dominio;
  if (!sugerido && !dominio.includes(".")) {
    // "juan@gmail" → "juan@gmail.com"
    sugerido = DOMINIOS_COMUNES.find((d) => d.split(".")[0] === dominio) ?? null;
  }
  if (!sugerido) {
    let mejor = 3;
    for (const d of DOMINIOS_COMUNES) {
      const dist = distancia(dominio, d);
      if (dist < mejor) {
        mejor = dist;
        sugerido = d;
      }
    }
  }
  // Un .con que no es de un dominio común igual se corrige (no existe ese final).
  if (!sugerido && dominio !== original && /\.[a-z]{2,}$/.test(dominio)) sugerido = dominio;
  if (!sugerido || sugerido === original) return null;
  return `${usuario}@${sugerido}`;
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
