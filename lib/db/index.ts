import { isSupabaseConfigured } from "@/lib/config";
import * as mock from "@/lib/mock/db";
import * as supabase from "@/lib/supabase/queries";

function useSupabase() {
  return isSupabaseConfigured();
}

export async function getEventoActivo() {
  return useSupabase() ? supabase.getEventoActivo() : mock.getEventoActivo();
}

export async function updateEvento(data: Parameters<typeof mock.updateEvento>[0]) {
  return useSupabase() ? supabase.updateEvento(data) : mock.updateEvento(data);
}

export async function createOrdenPendiente(
  input: Parameters<typeof mock.createOrdenPendiente>[0]
) {
  return useSupabase()
    ? supabase.createOrdenPendiente(input)
    : mock.createOrdenPendiente(input);
}

export async function approveOrden(ordenId: string) {
  return useSupabase()
    ? supabase.approveOrden(ordenId)
    : mock.approveOrden(ordenId);
}

export async function rejectOrden(ordenId: string) {
  return useSupabase()
    ? supabase.rejectOrden(ordenId)
    : mock.rejectOrden(ordenId);
}

export async function getOrden(ordenId: string) {
  if (useSupabase()) {
    const orden = await supabase.getOrden(ordenId);
    return orden ?? undefined;
  }
  return mock.getOrden(ordenId);
}

export async function getTicketsByOrden(ordenId: string) {
  return useSupabase()
    ? supabase.getTicketsByOrden(ordenId)
    : mock.getTicketsByOrden(ordenId);
}

export async function verifyTicket(ticketId: string) {
  return useSupabase()
    ? supabase.verifyTicket(ticketId)
    : mock.verifyTicket(ticketId);
}

export async function cancelTicket(ticketId: string, motivo?: string) {
  return useSupabase()
    ? supabase.cancelTicket(ticketId, motivo)
    : mock.cancelTicket(ticketId, motivo);
}

export async function refundOrden(ordenId: string) {
  return useSupabase()
    ? supabase.refundOrden(ordenId)
    : mock.refundOrden(ordenId);
}

export async function getOrdenes() {
  return useSupabase() ? supabase.getOrdenes() : mock.getOrdenes();
}

export async function getTickets() {
  return useSupabase() ? supabase.getTickets() : mock.getTickets();
}

export async function getActivity() {
  return useSupabase() ? supabase.getActivity() : mock.getActivity();
}

export async function getAdminStats() {
  return useSupabase() ? supabase.getAdminStats() : mock.getAdminStats();
}

export function getDbMode(): "supabase" | "mock" {
  return useSupabase() ? "supabase" : "mock";
}
