import { isSupabaseConfigured } from "@/lib/config";
import * as mock from "@/lib/mock/db";
import * as supabase from "@/lib/supabase/queries";
import type { NuevoEventoInput } from "@/types";

function shouldUseSupabase() {
  return isSupabaseConfigured();
}

export async function getEventoActivo() {
  return shouldUseSupabase() ? supabase.getEventoActivo() : mock.getEventoActivo();
}

export async function updateEvento(data: Parameters<typeof mock.updateEvento>[0]) {
  return shouldUseSupabase() ? supabase.updateEvento(data) : mock.updateEvento(data);
}

export async function createOrdenPendiente(
  input: Parameters<typeof mock.createOrdenPendiente>[0]
) {
  return shouldUseSupabase()
    ? supabase.createOrdenPendiente(input)
    : mock.createOrdenPendiente(input);
}

export async function approveOrden(ordenId: string) {
  return shouldUseSupabase()
    ? supabase.approveOrden(ordenId)
    : mock.approveOrden(ordenId);
}

export async function rejectOrden(ordenId: string) {
  return shouldUseSupabase()
    ? supabase.rejectOrden(ordenId)
    : mock.rejectOrden(ordenId);
}

export async function getOrden(ordenId: string) {
  if (shouldUseSupabase()) {
    const orden = await supabase.getOrden(ordenId);
    return orden ?? undefined;
  }
  return mock.getOrden(ordenId);
}

export async function getTicketsByOrden(ordenId: string) {
  return shouldUseSupabase()
    ? supabase.getTicketsByOrden(ordenId)
    : mock.getTicketsByOrden(ordenId);
}

export async function verifyTicket(ticketId: string) {
  return shouldUseSupabase()
    ? supabase.verifyTicket(ticketId)
    : mock.verifyTicket(ticketId);
}

export async function cancelTicket(ticketId: string, motivo?: string) {
  return shouldUseSupabase()
    ? supabase.cancelTicket(ticketId, motivo)
    : mock.cancelTicket(ticketId, motivo);
}

export async function refundOrden(ordenId: string) {
  return shouldUseSupabase()
    ? supabase.refundOrden(ordenId)
    : mock.refundOrden(ordenId);
}

export async function getOrdenes() {
  return shouldUseSupabase() ? supabase.getOrdenes() : mock.getOrdenes();
}

export async function getTickets() {
  return shouldUseSupabase() ? supabase.getTickets() : mock.getTickets();
}

export async function getActivity() {
  return shouldUseSupabase() ? supabase.getActivity() : mock.getActivity();
}

export async function getAdminStats() {
  return shouldUseSupabase() ? supabase.getAdminStats() : mock.getAdminStats();
}

export async function resetVentasEventoActivo() {
  return shouldUseSupabase()
    ? supabase.resetVentasEventoActivo()
    : mock.resetVentasEventoActivo();
}

export async function abrirVentaEvento() {
  return shouldUseSupabase()
    ? supabase.abrirVentaEvento()
    : mock.abrirVentaEvento();
}

export async function cerrarEventoActivo() {
  return shouldUseSupabase()
    ? supabase.cerrarEventoActivo()
    : mock.cerrarEventoActivo();
}

export async function getEventosFinalizados() {
  return shouldUseSupabase()
    ? supabase.getEventosFinalizados()
    : mock.getEventosFinalizados();
}

export async function getOrdenesByEvento(eventoId: string) {
  return shouldUseSupabase()
    ? supabase.getOrdenesByEvento(eventoId)
    : mock.getOrdenesByEvento(eventoId);
}

export async function getTicketsByEvento(eventoId: string) {
  return shouldUseSupabase()
    ? supabase.getTicketsByEvento(eventoId)
    : mock.getTicketsByEvento(eventoId);
}

export async function getHistorialItems() {
  return shouldUseSupabase()
    ? supabase.getHistorialItems()
    : mock.getHistorialItems();
}

export async function crearNuevoEvento(input: NuevoEventoInput) {
  return shouldUseSupabase()
    ? supabase.crearNuevoEvento(input)
    : mock.crearNuevoEvento(input);
}

export function getDbMode(): "supabase" | "mock" {
  return shouldUseSupabase() ? "supabase" : "mock";
}
