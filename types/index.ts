export type OrdenEstado = "pendiente" | "aprobado" | "rechazado" | "reembolsado";

export type EventoEstado = "borrador" | "venta" | "finalizado";

export type ActivityTipo = "venta" | "ingreso" | "baja" | "reembolso";

export interface Evento {
  id: string;
  nombre: string;
  fecha: string;
  precio: number;
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
}

export interface Orden {
  id: string;
  eventoId: string;
  mpPaymentId: string | null;
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
}

export type VerifyStatus = "valido" | "usada" | "cancelada" | "invalido";

export interface VerifyResult {
  status: VerifyStatus;
  ticket?: Ticket;
  message: string;
}

export interface NuevoEventoInput {
  nombre: string;
  fecha: string;
  precio: number;
  capacidad: number;
  copiarBranding: boolean;
}

export interface HistorialItem {
  evento: Evento;
  stats: AdminStats;
}
