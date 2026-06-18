export interface EventoRow {
  id: string;
  nombre: string;
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

export interface OrdenRow {
  id: string;
  evento_id: string;
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
