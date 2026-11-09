import { isSupabaseConfigured } from "@/lib/config";
import * as mock from "@/lib/mock/db";
import * as supabase from "@/lib/supabase/queries";
import type {
  ActivityTipo,
  Branding,
  Evento,
  ModoPago,
  NuevoEventoInput,
  PaymentMethod,
  TipoEntradaInput,
} from "@/types";

function sb() {
  return isSupabaseConfigured();
}

export function getDbMode(): "supabase" | "mock" {
  return sb() ? "supabase" : "mock";
}

// ─── Eventos ─────────────────────────────────────────────────────────────

export async function getEventosPublicados() {
  return sb() ? supabase.getEventosPublicados() : mock.getEventosPublicados();
}

export async function getEventosAdmin() {
  return sb() ? supabase.getEventosAdmin() : mock.getEventosAdmin();
}

export async function getEventoById(eventoId: string) {
  return sb() ? supabase.getEventoById(eventoId) : mock.getEventoById(eventoId);
}

export async function getEventoBySlug(slug: string) {
  return sb() ? supabase.getEventoBySlug(slug) : mock.getEventoBySlug(slug);
}

export async function getCatalogo() {
  return sb() ? supabase.getCatalogo() : mock.getCatalogo();
}

export async function getEventoCatalogo(eventoId: string) {
  return sb() ? supabase.getEventoCatalogo(eventoId) : mock.getEventoCatalogo(eventoId);
}

export async function updateEvento(eventoId: string, data: Partial<Evento>) {
  return sb() ? supabase.updateEvento(eventoId, data) : mock.updateEvento(eventoId, data);
}

/** Fiesta pedida por el admin (?evento=) o la primera de la lista. */
export async function resolveEventoAdmin(eventoId?: string | null): Promise<Evento | null> {
  if (eventoId) return getEventoById(eventoId);
  const eventos = await getEventosAdmin();
  return eventos[0] ?? null;
}

// ─── Tipos de entrada ────────────────────────────────────────────────────

export async function getTiposByEvento(eventoId: string) {
  return sb() ? supabase.getTiposByEvento(eventoId) : mock.getTiposByEvento(eventoId);
}

export async function getTiposDisponibles(eventoId: string) {
  return sb() ? supabase.getTiposDisponibles(eventoId) : mock.getTiposDisponibles(eventoId);
}

export async function getTipoById(tipoId: string) {
  return sb() ? supabase.getTipoById(tipoId) : mock.getTipoById(tipoId);
}

export async function createTipo(eventoId: string, input: TipoEntradaInput) {
  return sb() ? supabase.createTipo(eventoId, input) : mock.createTipo(eventoId, input);
}

export async function updateTipo(tipoId: string, input: Partial<TipoEntradaInput>) {
  return sb() ? supabase.updateTipo(tipoId, input) : mock.updateTipo(tipoId, input);
}

export async function deleteTipo(tipoId: string) {
  return sb() ? supabase.deleteTipo(tipoId) : mock.deleteTipo(tipoId);
}

export async function reordenarTipos(eventoId: string, ids: string[]) {
  return sb() ? supabase.reordenarTipos(eventoId, ids) : mock.reordenarTipos(eventoId, ids);
}

// ─── Órdenes ─────────────────────────────────────────────────────────────

export async function createOrdenPendiente(input: {
  eventoId: string;
  tipoEntradaId: string;
  compradorNombre: string;
  compradorEmail: string;
  cantidad: number;
}) {
  return sb() ? supabase.createOrdenPendiente(input) : mock.createOrdenPendiente(input);
}

/** Simulado si no hubo medio de pago; si no, según el ambiente configurado de ese medio. */
async function resolverModoPago(paymentMethod?: PaymentMethod): Promise<ModoPago> {
  if (!paymentMethod) return "simulado";
  const { getPaymentSettings } = await import("@/lib/payments/settings");
  const settings = await getPaymentSettings();
  const env = paymentMethod === "mp" ? settings.mp.environment : settings.talo.environment;
  return env === "sandbox" ? "sandbox" : "produccion";
}

/**
 * Aprueba la orden (pago confirmado) y emite los tickets.
 * Después intenta mandar el mail con los links de descarga (no bloquea si falla).
 * `modoPago` lo puede informar el medio de pago (ej. `live_mode` de Mercado Pago).
 */
export async function approveOrden(
  ordenId: string,
  paymentId?: string,
  paymentMethod?: PaymentMethod,
  modoPago?: ModoPago
) {
  const modo = modoPago ?? (await resolverModoPago(paymentMethod));
  const result = sb()
    ? await supabase.approveOrden(ordenId, paymentId, paymentMethod, modo)
    : await mock.approveOrden(ordenId, paymentId, paymentMethod, modo);

  if (!("error" in result) && !result.orden.emailSentAt) {
    try {
      const { notifyOrdenAprobada } = await import("@/lib/email/notify");
      await notifyOrdenAprobada(result.orden.id);
    } catch (error) {
      console.error("[EMAIL] No se pudo enviar la confirmación:", error);
    }
  }
  return result;
}

export async function getOrdenByPaymentId(paymentId: string) {
  return sb() ? supabase.getOrdenByPaymentId(paymentId) : mock.getOrdenByPaymentId(paymentId);
}

export async function setOrdenPaymentId(ordenId: string, paymentId: string, paymentMethod?: PaymentMethod) {
  return sb()
    ? supabase.setOrdenPaymentId(ordenId, paymentId, paymentMethod)
    : mock.setOrdenPaymentId(ordenId, paymentId, paymentMethod);
}

export async function rejectOrden(ordenId: string) {
  return sb() ? supabase.rejectOrden(ordenId) : mock.rejectOrden(ordenId);
}

export async function getOrden(ordenId: string) {
  if (sb()) return (await supabase.getOrden(ordenId)) ?? undefined;
  return mock.getOrden(ordenId);
}

export async function getTicketsByOrden(ordenId: string) {
  return sb() ? supabase.getTicketsByOrden(ordenId) : mock.getTicketsByOrden(ordenId);
}

export async function getTicket(ticketId: string) {
  return sb() ? supabase.getTicket(ticketId) : mock.getTicket(ticketId);
}

export async function claimEmailSend(ordenId: string) {
  return sb() ? supabase.claimEmailSend(ordenId) : mock.claimEmailSend(ordenId);
}

export async function releaseEmailSend(ordenId: string) {
  return sb() ? supabase.releaseEmailSend(ordenId) : mock.releaseEmailSend(ordenId);
}

// ─── Puerta ──────────────────────────────────────────────────────────────

export async function verifyTicket(ticketId: string, eventoId?: string) {
  return sb() ? supabase.verifyTicket(ticketId, eventoId) : mock.verifyTicket(ticketId, eventoId);
}

export async function cancelTicket(ticketId: string, motivo?: string) {
  return sb() ? supabase.cancelTicket(ticketId, motivo) : mock.cancelTicket(ticketId, motivo);
}

export async function anularTickets(input: {
  ordenId: string;
  ticketIds: string[];
  motivo: string;
  devolverPlata: boolean;
}) {
  return sb() ? supabase.anularTickets(input) : mock.anularTickets(input);
}

/** Deja constancia en Actividad del panel (pagos, webhooks, etc.). No falla nunca. */
export async function registrarActividad(tipo: ActivityTipo, mensaje: string) {
  try {
    if (sb()) await supabase.logActivity(tipo, mensaje);
    else mock.logActivity(tipo, mensaje);
  } catch (error) {
    console.error("[ACTIVIDAD] no se pudo registrar:", error);
  }
}

// ─── Admin ───────────────────────────────────────────────────────────────

export async function getOrdenes(eventoId: string) {
  return sb() ? supabase.getOrdenes(eventoId) : mock.getOrdenes(eventoId);
}

export async function getTickets(eventoId: string) {
  return sb() ? supabase.getTickets(eventoId) : mock.getTickets(eventoId);
}

export async function getActivity() {
  return sb() ? supabase.getActivity() : mock.getActivity();
}

export async function getAdminStats(eventoId: string) {
  return sb() ? supabase.getAdminStats(eventoId) : mock.getAdminStats(eventoId);
}

export async function resetVentas(eventoId: string) {
  return sb() ? supabase.resetVentas(eventoId) : mock.resetVentas(eventoId);
}

export async function abrirVenta(eventoId: string) {
  return sb() ? supabase.abrirVenta(eventoId) : mock.abrirVenta(eventoId);
}

export async function pausarVentas(eventoId: string) {
  return sb() ? supabase.pausarVentas(eventoId) : mock.pausarVentas(eventoId);
}

export async function reanudarVentas(eventoId: string) {
  return sb() ? supabase.reanudarVentas(eventoId) : mock.reanudarVentas(eventoId);
}

export async function cerrarEvento(eventoId: string) {
  return sb() ? supabase.cerrarEvento(eventoId) : mock.cerrarEvento(eventoId);
}

export async function getEventosFinalizados() {
  return sb() ? supabase.getEventosFinalizados() : mock.getEventosFinalizados();
}

export async function getOrdenesByEvento(eventoId: string) {
  return sb() ? supabase.getOrdenesByEvento(eventoId) : mock.getOrdenesByEvento(eventoId);
}

export async function getTicketsByEvento(eventoId: string) {
  return sb() ? supabase.getTicketsByEvento(eventoId) : mock.getTicketsByEvento(eventoId);
}

export async function getHistorialItems() {
  return sb() ? supabase.getHistorialItems() : mock.getHistorialItems();
}

/** Ventas de todas las fiestas (activas y finalizadas) para el resumen general del admin. */
export async function getResumenGeneral() {
  const [activos, finalizados] = await Promise.all([getEventosAdmin(), getEventosFinalizados()]);
  const eventos = [...activos, ...finalizados];
  return Promise.all(eventos.map(async (evento) => ({ evento, stats: await getAdminStats(evento.id) })));
}

export async function crearNuevoEvento(input: NuevoEventoInput) {
  return sb() ? supabase.crearNuevoEvento(input) : mock.crearNuevoEvento(input);
}

// ─── Marca ───────────────────────────────────────────────────────────────

export async function getBranding() {
  return sb() ? supabase.getBranding() : mock.getBranding();
}

export async function updateBranding(data: Partial<Branding>) {
  return sb() ? supabase.updateBranding(data) : mock.updateBranding(data);
}
