export interface EventoRow {
  id: string;
  slug: string | null;
  nombre: string;
  subtitulo: string | null;
  dj: string | null;
  fecha: string;
  precio: number;
  capacidad: number;
  activo: boolean;
  estado: string;
  logo_url: string;
  flyer_url: string;
  color_primario: string;
  color_secundario: string;
  descripcion: string;
  lugar: string;
  maps_url: string;
  contacto_whatsapp: string;
  contacto_email: string;
  contacto_instagram: string;
  texto_footer: string;
  organizador_nombre: string;
  mensaje_postergado: string;
  created_at: string;
}

export interface TipoEntradaRow {
  id: string;
  evento_id: string;
  nombre: string;
  descripcion: string | null;
  beneficios: string[] | null;
  precio: number | string;
  cupo: number | null;
  venta_desde: string | null;
  venta_hasta: string | null;
  estilo: string;
  color_acento: string | null;
  activo: boolean;
  orden: number;
  created_at: string;
}

export interface OrdenRow {
  id: string;
  evento_id: string;
  tipo_entrada_id: string | null;
  tipo_nombre: string | null;
  precio_unitario: number | string | null;
  mp_payment_id: string | null;
  payment_method: string | null;
  comprador_nombre: string;
  comprador_email: string;
  cantidad: number;
  monto_total: number;
  estado: string;
  created_at: string;
  email_sent_at: string | null;
}

export interface TicketRow {
  id: string;
  orden_id: string;
  evento_id: string;
  tipo_entrada_id: string | null;
  tipo_nombre: string | null;
  estilo: string | null;
  comprador_nombre: string;
  comprador_email: string;
  numero_entrada: number;
  total_entradas: number;
  usado: boolean;
  cancelado: boolean;
  usado_at: string | null;
  cancelado_at: string | null;
  motivo_cancelacion: string | null;
  created_at: string;
}

export interface ActivityRow {
  id: string;
  tipo: string;
  mensaje: string;
  created_at: string;
}

export interface BrandingRow {
  id: string;
  nombre: string;
  logo_url: string;
  tagline: string;
  contacto_whatsapp: string;
  contacto_instagram: string;
  contacto_email: string;
  texto_footer: string;
  color_primario: string;
  color_secundario: string;
}
