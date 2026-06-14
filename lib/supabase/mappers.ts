import type { ActivityLog, Evento, Orden, OrdenEstado, Ticket } from "@/types";
import type {
  ActivityRow,
  EventoRow,
  OrdenRow,
  TicketRow,
} from "./types";

export function mapEvento(row: EventoRow): Evento {
  return {
    id: row.id,
    nombre: row.nombre,
    fecha: row.fecha,
    precio: Number(row.precio),
    capacidad: row.capacidad,
    activo: row.activo,
    logoUrl: row.logo_url,
    flyerUrl: row.flyer_url,
    colorPrimario: row.color_primario,
    colorSecundario: row.color_secundario,
    descripcion: row.descripcion,
    lugar: row.lugar,
    mapsUrl: row.maps_url,
    contactoWhatsapp: row.contacto_whatsapp,
    contactoEmail: row.contacto_email,
    contactoInstagram: row.contacto_instagram,
    textoFooter: row.texto_footer,
    organizadorNombre: row.organizador_nombre,
  };
}

export function mapEventoToRow(
  evento: Partial<Evento>
): Partial<EventoRow> {
  const row: Partial<EventoRow> = {};
  if (evento.id !== undefined) row.id = evento.id;
  if (evento.nombre !== undefined) row.nombre = evento.nombre;
  if (evento.fecha !== undefined) row.fecha = evento.fecha;
  if (evento.precio !== undefined) row.precio = evento.precio;
  if (evento.capacidad !== undefined) row.capacidad = evento.capacidad;
  if (evento.activo !== undefined) row.activo = evento.activo;
  if (evento.logoUrl !== undefined) row.logo_url = evento.logoUrl;
  if (evento.flyerUrl !== undefined) row.flyer_url = evento.flyerUrl;
  if (evento.colorPrimario !== undefined) row.color_primario = evento.colorPrimario;
  if (evento.colorSecundario !== undefined) row.color_secundario = evento.colorSecundario;
  if (evento.descripcion !== undefined) row.descripcion = evento.descripcion;
  if (evento.lugar !== undefined) row.lugar = evento.lugar;
  if (evento.mapsUrl !== undefined) row.maps_url = evento.mapsUrl;
  if (evento.contactoWhatsapp !== undefined) row.contacto_whatsapp = evento.contactoWhatsapp;
  if (evento.contactoEmail !== undefined) row.contacto_email = evento.contactoEmail;
  if (evento.contactoInstagram !== undefined) row.contacto_instagram = evento.contactoInstagram;
  if (evento.textoFooter !== undefined) row.texto_footer = evento.textoFooter;
  if (evento.organizadorNombre !== undefined) row.organizador_nombre = evento.organizadorNombre;
  return row;
}

export function mapOrden(row: OrdenRow): Orden {
  return {
    id: row.id,
    eventoId: row.evento_id,
    mpPaymentId: row.mp_payment_id,
    compradorNombre: row.comprador_nombre,
    compradorEmail: row.comprador_email,
    cantidad: row.cantidad,
    montoTotal: Number(row.monto_total),
    estado: row.estado as OrdenEstado,
    createdAt: row.created_at,
    emailSentAt: row.email_sent_at ?? null,
  };
}

export function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    ordenId: row.orden_id,
    eventoId: row.evento_id,
    compradorNombre: row.comprador_nombre,
    compradorEmail: row.comprador_email,
    numeroEntrada: row.numero_entrada,
    totalEntradas: row.total_entradas,
    usado: row.usado,
    cancelado: row.cancelado,
    usadoAt: row.usado_at,
    canceladoAt: row.cancelado_at,
    motivoCancelacion: row.motivo_cancelacion,
    createdAt: row.created_at,
  };
}

export function mapActivity(row: ActivityRow): ActivityLog {
  return {
    id: row.id,
    tipo: row.tipo as ActivityLog["tipo"],
    mensaje: row.mensaje,
    createdAt: row.created_at,
  };
}
