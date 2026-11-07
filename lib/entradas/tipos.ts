import { canComprarPublico } from "@/lib/evento/estado";
import type {
  AdminStats,
  EntradaEstilo,
  Evento,
  EventoCatalogo,
  Orden,
  StatsPorTipo,
  Ticket,
  TipoEntrada,
  TipoEntradaDisponible,
  TipoEntradaInput,
} from "@/types";

const TZ_AR = "America/Argentina/Buenos_Aires";

export const ESTILOS_VALIDOS: EntradaEstilo[] = ["anticipada", "general", "vip", "custom"];

export function fechaCortaAr(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ_AR,
  });
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isSlugValido(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 60;
}

export function uniqueSlug(base: string, existentes: string[]): string {
  const root = slugify(base) || "fiesta";
  if (!existentes.includes(root)) return root;
  let n = 2;
  while (existentes.includes(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

/** Valores sugeridos al crear un tipo desde los botones del admin. */
export const TIPO_PRESETS: Record<"anticipada" | "general" | "vip", Omit<TipoEntradaInput, "precio" | "orden">> = {
  anticipada: {
    nombre: "Anticipada",
    descripcion: "Mismo acceso que la General, a precio promo.",
    beneficios: [],
    cupo: null,
    ventaDesde: null,
    ventaHasta: null,
    estilo: "anticipada",
    colorAcento: "",
    activo: true,
  },
  general: {
    nombre: "General",
    descripcion: "Acceso a la fiesta toda la noche.",
    beneficios: [],
    cupo: null,
    ventaDesde: null,
    ventaHasta: null,
    estilo: "general",
    colorAcento: "",
    activo: true,
  },
  vip: {
    nombre: "VIP",
    descripcion: "Sector VIP con beneficios exclusivos.",
    beneficios: ["Sector VIP", "Barra exclusiva"],
    cupo: 40,
    ventaDesde: null,
    ventaHasta: null,
    estilo: "vip",
    colorAcento: "",
    activo: true,
  },
};

function toIsoOrNull(value: unknown): string | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "invalid";
  return d.toISOString();
}

/** Valida y normaliza lo que manda el admin. `parcial` = PUT (solo campos presentes). */
export function normalizarTipoInput(
  raw: Record<string, unknown>,
  parcial: boolean
): { value: Partial<TipoEntradaInput> } | { error: string } {
  const out: Partial<TipoEntradaInput> = {};

  if (!parcial || raw.nombre !== undefined) {
    const nombre = String(raw.nombre ?? "").trim();
    if (!nombre) return { error: "El nombre es obligatorio" };
    if (nombre.length > 40) return { error: "El nombre puede tener hasta 40 caracteres" };
    out.nombre = nombre;
  }
  if (!parcial || raw.precio !== undefined) {
    const precio = Number(raw.precio);
    if (!Number.isFinite(precio) || precio <= 0) return { error: "El precio debe ser mayor a 0" };
    out.precio = Math.round(precio * 100) / 100;
  }
  if (!parcial || raw.cupo !== undefined) {
    if (raw.cupo === null || raw.cupo === "" || raw.cupo === undefined) {
      out.cupo = null;
    } else {
      const cupo = Number(raw.cupo);
      if (!Number.isInteger(cupo) || cupo < 1) return { error: "El cupo debe ser un número entero mayor a 0 (o vacío para sin tope)" };
      out.cupo = cupo;
    }
  }
  if (!parcial || raw.ventaDesde !== undefined) {
    const v = toIsoOrNull(raw.ventaDesde);
    if (v === "invalid") return { error: "Fecha 'venta desde' inválida" };
    out.ventaDesde = v;
  }
  if (!parcial || raw.ventaHasta !== undefined) {
    const v = toIsoOrNull(raw.ventaHasta);
    if (v === "invalid") return { error: "Fecha 'venta hasta' inválida" };
    out.ventaHasta = v;
  }
  if (out.ventaDesde && out.ventaHasta && out.ventaDesde >= out.ventaHasta) {
    return { error: "'Venta desde' tiene que ser anterior a 'venta hasta'" };
  }
  if (!parcial || raw.estilo !== undefined) {
    const estilo = String(raw.estilo ?? "general") as EntradaEstilo;
    if (!ESTILOS_VALIDOS.includes(estilo)) return { error: "Diseño inválido" };
    out.estilo = estilo;
  }
  if (!parcial || raw.colorAcento !== undefined) {
    const color = String(raw.colorAcento ?? "").trim();
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Color inválido (usá formato #RRGGBB)" };
    out.colorAcento = color;
  }
  if (!parcial || raw.descripcion !== undefined) {
    out.descripcion = String(raw.descripcion ?? "").trim().slice(0, 200);
  }
  if (!parcial || raw.beneficios !== undefined) {
    const lista = Array.isArray(raw.beneficios)
      ? raw.beneficios
      : String(raw.beneficios ?? "").split("\n");
    out.beneficios = lista
      .map((b) => String(b).trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((b) => b.slice(0, 60));
  }
  if (!parcial || raw.activo !== undefined) {
    out.activo = raw.activo === undefined ? true : Boolean(raw.activo);
  }
  if (!parcial || raw.orden !== undefined) {
    const orden = Number(raw.orden ?? 0);
    out.orden = Number.isFinite(orden) ? Math.trunc(orden) : 0;
  }
  return { value: out };
}

export function ordenarTipos<T extends Pick<TipoEntrada, "orden" | "precio">>(tipos: T[]): T[] {
  return [...tipos].sort((a, b) => a.orden - b.orden || a.precio - b.precio);
}

function contarVendidas(tickets: Ticket[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tickets) {
    if (t.cancelado) continue;
    const key = t.tipoEntradaId ?? "";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/**
 * Calcula, para cada tipo, si se puede comprar ahora y cuánto queda.
 * `tickets` = todos los tickets de la fiesta (se ignoran los cancelados).
 */
export function evaluarTipos(
  evento: Evento,
  tipos: TipoEntrada[],
  tickets: Ticket[],
  now: Date = new Date()
): TipoEntradaDisponible[] {
  const vendidasPorTipo = contarVendidas(tickets);
  const activosEvento = tickets.filter((t) => !t.cancelado).length;
  const restanteEvento = Math.max(0, evento.capacidad - activosEvento);

  return ordenarTipos(tipos).map((tipo) => {
    const vendidas = vendidasPorTipo.get(tipo.id) ?? 0;
    const restanteTipo = tipo.cupo === null ? Infinity : Math.max(0, tipo.cupo - vendidas);
    const disponibles = Math.min(restanteEvento, restanteTipo);

    let motivo: string | null = null;
    if (!tipo.activo) motivo = "No disponible";
    else if (evento.estado === "pausado") motivo = "Ventas pausadas";
    else if (evento.estado === "finalizado") motivo = "Finalizado";
    else if (tipo.ventaDesde && now < new Date(tipo.ventaDesde))
      motivo = `Desde el ${fechaCortaAr(tipo.ventaDesde)}`;
    else if (tipo.ventaHasta && now > new Date(tipo.ventaHasta))
      motivo = `Cerró el ${fechaCortaAr(tipo.ventaHasta)}`;
    else if (disponibles <= 0) motivo = "Agotada";

    return {
      ...tipo,
      vendidas,
      disponibles,
      comprable: motivo === null && canComprarPublico(evento.estado),
      motivo,
    };
  });
}

export function buildCatalogo(
  evento: Evento,
  tipos: TipoEntrada[],
  tickets: Ticket[],
  now: Date = new Date()
): EventoCatalogo {
  const evaluados = evaluarTipos(evento, tipos, tickets, now).filter((t) => t.activo);
  const comprables = evaluados.filter((t) => t.comprable);
  const base = comprables.length ? comprables : evaluados;
  const precioDesde = base.length ? Math.min(...base.map((t) => t.precio)) : null;
  const activos = tickets.filter((t) => !t.cancelado).length;
  const anticipada = comprables.find((t) => t.estilo === "anticipada" && t.ventaHasta);

  return {
    evento,
    precioDesde,
    disponibles: Math.max(0, evento.capacidad - activos),
    anticipadaHasta: anticipada?.ventaHasta ?? null,
    tipos: evaluados,
  };
}

/** Motivo legible si el tipo no se puede comprar con esa cantidad. */
export function validarCompraTipo(
  disponible: TipoEntradaDisponible | undefined,
  cantidad: number
): string | null {
  if (!disponible) return "Ese tipo de entrada no existe para esta fiesta";
  if (!disponible.comprable) {
    return disponible.motivo === "Agotada"
      ? `${disponible.nombre}: agotada`
      : `${disponible.nombre}: ${disponible.motivo ?? "no disponible"}`;
  }
  if (cantidad > disponible.disponibles) {
    return `Solo quedan ${disponible.disponibles} entradas ${disponible.nombre}`;
  }
  return null;
}

export function computeStats(
  evento: Pick<Evento, "capacidad">,
  tipos: TipoEntrada[],
  ordenes: Orden[],
  tickets: Ticket[]
): AdminStats {
  const activas = tickets.filter((t) => !t.cancelado);
  const aprobadas = ordenes.filter((o) => o.estado === "aprobado");
  const recaudado = aprobadas.reduce((sum, o) => sum + o.montoTotal, 0);
  const reembolsado = ordenes
    .filter((o) => o.estado === "reembolsado")
    .reduce((sum, o) => sum + o.montoTotal, 0);

  const porTipo: StatsPorTipo[] = ordenarTipos(tipos).map((tipo) => ({
    tipoEntradaId: tipo.id,
    nombre: tipo.nombre,
    estilo: tipo.estilo,
    vendidas: activas.filter((t) => t.tipoEntradaId === tipo.id).length,
    cupo: tipo.cupo,
    recaudado: aprobadas
      .filter((o) => o.tipoEntradaId === tipo.id)
      .reduce((sum, o) => sum + o.montoTotal, 0),
  }));

  const sinTipo = activas.filter((t) => !t.tipoEntradaId || !tipos.some((x) => x.id === t.tipoEntradaId));
  if (sinTipo.length > 0) {
    porTipo.push({
      tipoEntradaId: null,
      nombre: "Otras",
      estilo: "general",
      vendidas: sinTipo.length,
      cupo: null,
      recaudado: aprobadas
        .filter((o) => !o.tipoEntradaId || !tipos.some((x) => x.id === o.tipoEntradaId))
        .reduce((sum, o) => sum + o.montoTotal, 0),
    });
  }

  return {
    vendidasActivas: activas.length,
    recaudado,
    sinUsar: activas.filter((t) => !t.usado).length,
    ingresaron: activas.filter((t) => t.usado).length,
    canceladas: tickets.filter((t) => t.cancelado).length,
    reembolsado,
    capacidad: evento.capacidad,
    disponibles: evento.capacidad - activas.length,
    totalOrdenes: aprobadas.length,
    porTipo,
  };
}

export function horaAr(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ_AR,
  });
}
