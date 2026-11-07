export type OrdenEstado = "pendiente" | "aprobado" | "rechazado" | "reembolsado";

export type EventoEstado = "borrador" | "venta" | "pausado" | "finalizado";

export type ActivityTipo = "venta" | "ingreso" | "baja" | "reembolso";

/** Diseño visual de la entrada (web, PDF, mail y scanner). */
export type EntradaEstilo = "anticipada" | "general" | "vip" | "custom";

export interface Evento {
  id: string;
  slug: string;
  nombre: string;
  /** Línea secundaria, ej. "Egresados Promo 2026". */
  subtitulo: string;
  dj: string;
  fecha: string;
  /** Legado: el precio vive en los tipos de entrada. */
  precio: number;
  /** Aforo total de la fiesta. */
  capacidad: number;
  activo: boolean;
  estado: EventoEstado;
  logoUrl: string;
  flyerUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  descripcion: string;
  lugar: string;
  mapsUrl: string;
  contactoWhatsapp: string;
  contactoEmail: string;
  contactoInstagram: string;
  textoFooter: string;
  organizadorNombre: string;
  mensajePostergado: string;
}

export interface TipoEntrada {
  id: string;
  eventoId: string;
  nombre: string;
  descripcion: string;
  beneficios: string[];
  precio: number;
  /** null = sin tope propio (solo el aforo de la fiesta). */
  cupo: number | null;
  /** null = desde ya. */
  ventaDesde: string | null;
  /** null = hasta el día de la fiesta. */
  ventaHasta: string | null;
  estilo: EntradaEstilo;
  /** Solo para estilo "custom" ('' = color de la fiesta). */
  colorAcento: string;
  activo: boolean;
  orden: number;
  createdAt: string;
}

export type TipoEntradaInput = Omit<TipoEntrada, "id" | "eventoId" | "createdAt">;

/** Tipo con disponibilidad calculada (lo que ve el comprador). */
export interface TipoEntradaDisponible extends TipoEntrada {
  vendidas: number;
  /** Lo que queda de este tipo (mínimo entre su cupo y el aforo restante). */
  disponibles: number;
  comprable: boolean;
  /** Motivo si no es comprable: "Agotada", "Cerró el 27/11", etc. */
  motivo: string | null;
}

export interface EventoCatalogo {
  evento: Evento;
  precioDesde: number | null;
  disponibles: number;
  /** Fecha de cierre de la anticipada vigente, si hay. */
  anticipadaHasta: string | null;
  tipos: TipoEntradaDisponible[];
}

export interface Branding {
  nombre: string;
  logoUrl: string;
  tagline: string;
  contactoWhatsapp: string;
  contactoInstagram: string;
  contactoEmail: string;
  textoFooter: string;
  colorPrimario: string;
  colorSecundario: string;
}

export type PaymentMethod = "mp" | "talo";

export interface Orden {
  id: string;
  eventoId: string;
  tipoEntradaId: string | null;
  tipoNombre: string;
  precioUnitario: number;
  paymentId: string | null;
  paymentMethod: PaymentMethod | null;
  compradorNombre: string;
  compradorEmail: string;
  cantidad: number;
  montoTotal: number;
  estado: OrdenEstado;
  createdAt: string;
  emailSentAt: string | null;
}

export interface Ticket {
  id: string;
  ordenId: string;
  eventoId: string;
  tipoEntradaId: string | null;
  tipoNombre: string;
  estilo: EntradaEstilo;
  compradorNombre: string;
  compradorEmail: string;
  numeroEntrada: number;
  totalEntradas: number;
  usado: boolean;
  cancelado: boolean;
  usadoAt: string | null;
  canceladoAt: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  tipo: ActivityTipo;
  mensaje: string;
  createdAt: string;
}

export interface StatsPorTipo {
  tipoEntradaId: string | null;
  nombre: string;
  estilo: EntradaEstilo;
  vendidas: number;
  cupo: number | null;
  recaudado: number;
}

export interface AdminStats {
  vendidasActivas: number;
  recaudado: number;
  sinUsar: number;
  ingresaron: number;
  canceladas: number;
  reembolsado: number;
  capacidad: number;
  disponibles: number;
  totalOrdenes: number;
  porTipo: StatsPorTipo[];
}

export type VerifyStatus = "valido" | "usada" | "cancelada" | "otro_evento" | "invalido";

export interface VerifyResult {
  status: VerifyStatus;
  ticket?: Ticket;
  /** Nombre de la fiesta del ticket (útil en "otro_evento"). */
  eventoNombre?: string;
  eventoFecha?: string;
  message: string;
}

export interface NuevoEventoInput {
  nombre: string;
  fecha: string;
  /** Precio del tipo "General" inicial. */
  precio: number;
  capacidad: number;
  copiarBranding: boolean;
}

export interface HistorialItem {
  evento: Evento;
  stats: AdminStats;
}
