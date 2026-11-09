import { ESTILOS_VALIDOS } from "@/lib/entradas/tipos";
import { POLITICA_ANULACION_DEFAULT } from "@/lib/mock/seed";
import type {
  ActivityLog,
  Branding,
  EntradaEstilo,
  Evento,
  ModoPago,
  Orden,
  OrdenEstado,
  Ticket,
  TipoEntrada,
  TipoEntradaInput,
} from "@/types";
import type {
  ActivityRow,
  BrandingRow,
  EventoRow,
  OrdenRow,
  TicketRow,
  TipoEntradaRow,
} from "./types";

function toModoPago(value: string | null | undefined): ModoPago | null {
  return value === "simulado" || value === "sandbox" || value === "produccion" ? value : null;
}

function toEstilo(value: string | null | undefined): EntradaEstilo {
  return ESTILOS_VALIDOS.includes(value as EntradaEstilo) ? (value as EntradaEstilo) : "general";
}

export function mapEvento(row: EventoRow): Evento {
  return {
    id: row.id,
    slug: row.slug || row.id,
    nombre: row.nombre,
    subtitulo: row.subtitulo ?? "",
    dj: row.dj ?? "",
    fecha: row.fecha,
    precio: Number(row.precio),
    capacidad: row.capacidad,
    activo: row.activo,
    estado: (row.estado as Evento["estado"]) || "borrador",
    logoUrl: row.logo_url ?? "",
    flyerUrl: row.flyer_url ?? "",
    colorPrimario: row.color_primario ?? "#d4a853",
    colorSecundario: row.color_secundario ?? "#0b0b10",
    descripcion: row.descripcion ?? "",
    lugar: row.lugar ?? "",
    mapsUrl: row.maps_url ?? "",
    contactoWhatsapp: row.contacto_whatsapp ?? "",
    contactoEmail: row.contacto_email ?? "",
    contactoInstagram: row.contacto_instagram ?? "",
    textoFooter: row.texto_footer ?? "",
    organizadorNombre: row.organizador_nombre ?? "",
    mensajePostergado: row.mensaje_postergado ?? "",
    proximamente: row.proximamente === true,
    ventaAbre: row.venta_abre ?? null,
  };
}

export function mapEventoToRow(evento: Partial<Evento>): Partial<EventoRow> {
  const row: Partial<EventoRow> = {};
  if (evento.id !== undefined) row.id = evento.id;
  if (evento.slug !== undefined) row.slug = evento.slug;
  if (evento.nombre !== undefined) row.nombre = evento.nombre;
  if (evento.subtitulo !== undefined) row.subtitulo = evento.subtitulo;
  if (evento.dj !== undefined) row.dj = evento.dj;
  if (evento.fecha !== undefined) row.fecha = evento.fecha;
  if (evento.precio !== undefined) row.precio = evento.precio;
  if (evento.capacidad !== undefined) row.capacidad = evento.capacidad;
  if (evento.activo !== undefined) row.activo = evento.activo;
  if (evento.estado !== undefined) row.estado = evento.estado;
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
  if (evento.mensajePostergado !== undefined) row.mensaje_postergado = evento.mensajePostergado;
  if (evento.proximamente !== undefined) row.proximamente = evento.proximamente;
  if (evento.ventaAbre !== undefined) row.venta_abre = evento.ventaAbre;
  return row;
}

export function mapTipo(row: TipoEntradaRow): TipoEntrada {
  return {
    id: row.id,
    eventoId: row.evento_id,
    nombre: row.nombre,
    descripcion: row.descripcion ?? "",
    beneficios: row.beneficios ?? [],
    precio: Number(row.precio),
    cupo: row.cupo,
    ventaDesde: row.venta_desde,
    ventaHasta: row.venta_hasta,
    estilo: toEstilo(row.estilo),
    colorAcento: row.color_acento ?? "",
    activo: row.activo,
    orden: row.orden ?? 0,
    proximamente: row.proximamente === true,
    mostrarPrecioPrevio: row.mostrar_precio_previo === true,
    createdAt: row.created_at,
  };
}

export function mapTipoToRow(input: Partial<TipoEntradaInput>): Partial<TipoEntradaRow> {
  const row: Partial<TipoEntradaRow> = {};
  if (input.nombre !== undefined) row.nombre = input.nombre;
  if (input.descripcion !== undefined) row.descripcion = input.descripcion;
  if (input.beneficios !== undefined) row.beneficios = input.beneficios;
  if (input.precio !== undefined) row.precio = input.precio;
  if (input.cupo !== undefined) row.cupo = input.cupo;
  if (input.ventaDesde !== undefined) row.venta_desde = input.ventaDesde;
  if (input.ventaHasta !== undefined) row.venta_hasta = input.ventaHasta;
  if (input.estilo !== undefined) row.estilo = input.estilo;
  if (input.colorAcento !== undefined) row.color_acento = input.colorAcento;
  if (input.activo !== undefined) row.activo = input.activo;
  if (input.orden !== undefined) row.orden = input.orden;
  if (input.proximamente !== undefined) row.proximamente = input.proximamente;
  if (input.mostrarPrecioPrevio !== undefined) row.mostrar_precio_previo = input.mostrarPrecioPrevio;
  return row;
}

export function mapOrden(row: OrdenRow): Orden {
  const montoTotal = Number(row.monto_total);
  return {
    id: row.id,
    eventoId: row.evento_id,
    tipoEntradaId: row.tipo_entrada_id ?? null,
    tipoNombre: row.tipo_nombre || "General",
    precioUnitario:
      row.precio_unitario != null
        ? Number(row.precio_unitario)
        : row.cantidad > 0
          ? montoTotal / row.cantidad
          : montoTotal,
    paymentId: row.mp_payment_id,
    paymentMethod:
      row.payment_method === "mp" || row.payment_method === "talo" ? row.payment_method : null,
    compradorNombre: row.comprador_nombre,
    compradorEmail: row.comprador_email,
    cantidad: row.cantidad,
    montoTotal,
    estado: row.estado as OrdenEstado,
    createdAt: row.created_at,
    emailSentAt: row.email_sent_at ?? null,
    modoPago: toModoPago(row.modo_pago),
    montoReembolsado: Number(row.monto_reembolsado ?? 0) || 0,
    problema: row.problema === "pago_sin_cupo" ? "pago_sin_cupo" : null,
  };
}

export function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    ordenId: row.orden_id,
    eventoId: row.evento_id,
    tipoEntradaId: row.tipo_entrada_id ?? null,
    tipoNombre: row.tipo_nombre || "General",
    estilo: toEstilo(row.estilo),
    compradorNombre: row.comprador_nombre,
    compradorEmail: row.comprador_email,
    numeroEntrada: row.numero_entrada,
    totalEntradas: row.total_entradas,
    usado: row.usado,
    cancelado: row.cancelado,
    usadoAt: row.usado_at,
    canceladoAt: row.cancelado_at,
    motivoCancelacion: row.motivo_cancelacion,
    reembolsado: row.reembolsado === true,
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

export function mapBranding(row: BrandingRow): Branding {
  return {
    nombre: row.nombre ?? "",
    logoUrl: row.logo_url ?? "",
    tagline: row.tagline ?? "",
    contactoWhatsapp: row.contacto_whatsapp ?? "",
    contactoInstagram: row.contacto_instagram ?? "",
    contactoEmail: row.contacto_email ?? "",
    textoFooter: row.texto_footer ?? "",
    colorPrimario: row.color_primario ?? "#d4a853",
    colorSecundario: row.color_secundario ?? "#050508",
    politicaAnulacion: row.politica_anulacion ?? POLITICA_ANULACION_DEFAULT,
  };
}

export function mapBrandingToRow(data: Partial<Branding>): Partial<BrandingRow> {
  const row: Partial<BrandingRow> = {};
  if (data.nombre !== undefined) row.nombre = data.nombre;
  if (data.logoUrl !== undefined) row.logo_url = data.logoUrl;
  if (data.tagline !== undefined) row.tagline = data.tagline;
  if (data.contactoWhatsapp !== undefined) row.contacto_whatsapp = data.contactoWhatsapp;
  if (data.contactoInstagram !== undefined) row.contacto_instagram = data.contactoInstagram;
  if (data.contactoEmail !== undefined) row.contacto_email = data.contactoEmail;
  if (data.textoFooter !== undefined) row.texto_footer = data.textoFooter;
  if (data.colorPrimario !== undefined) row.color_primario = data.colorPrimario;
  if (data.colorSecundario !== undefined) row.color_secundario = data.colorSecundario;
  if (data.politicaAnulacion !== undefined) row.politica_anulacion = data.politicaAnulacion;
  return row;
}
