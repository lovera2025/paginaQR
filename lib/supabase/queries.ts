import { createServerClient } from "./server";
import {
  mapActivity,
  mapEvento,
  mapEventoToRow,
  mapOrden,
  mapTicket,
} from "./mappers";
import { sendOrderConfirmationEmail } from "@/lib/email/send";
import type {
  ActivityLog,
  AdminStats,
  Evento,
  Orden,
  Ticket,
  VerifyResult,
} from "@/types";

function db() {
  const client = createServerClient();
  if (!client) throw new Error("Supabase no configurado");
  return client;
}

async function logActivity(tipo: ActivityLog["tipo"], mensaje: string) {
  await db().from("activity_log").insert({ tipo, mensaje });
}

async function trySendConfirmationEmail(
  ordenId: string,
  orden: Orden,
  tickets: Ticket[],
  evento: Evento
): Promise<Orden> {
  const result = await sendOrderConfirmationEmail({ orden, tickets, evento });
  if (!result.sent) return orden;

  const { data } = await db()
    .from("ordenes")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", ordenId)
    .is("email_sent_at", null)
    .select()
    .maybeSingle();

  return data ? mapOrden(data) : { ...orden, emailSentAt: new Date().toISOString() };
}

async function countTicketsActivos(): Promise<number> {
  const { count } = await db()
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("cancelado", false);
  return count ?? 0;
}

export async function getEventoActivo(): Promise<Evento | null> {
  const { data, error } = await db()
    .from("eventos")
    .select("*")
    .eq("activo", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapEvento(data);
}

export async function updateEvento(data: Partial<Evento>): Promise<Evento> {
  const evento = await getEventoActivo();
  if (!evento) throw new Error("No hay evento activo");

  const { data: updated, error } = await db()
    .from("eventos")
    .update(mapEventoToRow(data))
    .eq("id", evento.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapEvento(updated);
}

export async function createOrdenPendiente(input: {
  compradorNombre: string;
  compradorEmail: string;
  cantidad: number;
}): Promise<{ orden: Orden } | { error: string }> {
  const evento = await getEventoActivo();
  if (!evento) return { error: "No hay evento activo" };
  if (input.cantidad < 1 || input.cantidad > 10)
    return { error: "Cantidad inválida (1-10)" };
  if (!input.compradorNombre.trim() || !input.compradorEmail.trim())
    return { error: "Nombre y email son obligatorios" };

  const activos = await countTicketsActivos();
  if (activos + input.cantidad > evento.capacidad)
    return { error: `Solo quedan ${evento.capacidad - activos} entradas` };

  const { data, error } = await db()
    .from("ordenes")
    .insert({
      evento_id: evento.id,
      comprador_nombre: input.compradorNombre.trim(),
      comprador_email: input.compradorEmail.trim().toLowerCase(),
      cantidad: input.cantidad,
      monto_total: evento.precio * input.cantidad,
      estado: "pendiente",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { orden: mapOrden(data) };
}

export async function approveOrden(
  ordenId: string
): Promise<{ orden: Orden; tickets: Ticket[] } | { error: string }> {
  const { data: ordenRow, error: ordenError } = await db()
    .from("ordenes")
    .select("*")
    .eq("id", ordenId)
    .single();

  if (ordenError || !ordenRow) return { error: "Orden no encontrada" };
  const orden = mapOrden(ordenRow);

  if (orden.estado === "aprobado") {
    const existing = await getTicketsByOrden(ordenId);
    const evento = await getEventoActivo();
    if (evento && existing.length > 0) {
      const ordenWithEmail = await trySendConfirmationEmail(
        ordenId,
        orden,
        existing,
        evento
      );
      return { orden: ordenWithEmail, tickets: existing };
    }
    return { orden, tickets: existing };
  }
  if (orden.estado !== "pendiente") return { error: "Orden no está pendiente" };

  const activos = await countTicketsActivos();
  const evento = await getEventoActivo();
  if (!evento) return { error: "No hay evento activo" };
  if (activos + orden.cantidad > evento.capacidad)
    return { error: "Capacidad agotada" };

  const mpPaymentId = `mock_${orden.id.slice(0, 8)}`;
  const { error: updateError } = await db()
    .from("ordenes")
    .update({ estado: "aprobado", mp_payment_id: mpPaymentId })
    .eq("id", ordenId)
    .eq("estado", "pendiente");

  if (updateError) return { error: updateError.message };

  const ticketRows = Array.from({ length: orden.cantidad }, (_, i) => ({
    orden_id: orden.id,
    evento_id: orden.eventoId,
    comprador_nombre: orden.compradorNombre,
    comprador_email: orden.compradorEmail,
    numero_entrada: i + 1,
    total_entradas: orden.cantidad,
  }));

  const { data: ticketsData, error: ticketsError } = await db()
    .from("tickets")
    .insert(ticketRows)
    .select();

  if (ticketsError) return { error: ticketsError.message };

  const tickets = ticketsData.map(mapTicket);
  const updatedOrden = { ...orden, estado: "aprobado" as const, mpPaymentId };

  await logActivity(
    "venta",
    `Venta: ${orden.compradorNombre}, ${orden.cantidad} entrada(s), $${orden.montoTotal.toLocaleString("es-AR")}`
  );

  const ordenWithEmail = await trySendConfirmationEmail(
    ordenId,
    updatedOrden,
    tickets,
    evento
  );

  return { orden: ordenWithEmail, tickets };
}

export async function rejectOrden(
  ordenId: string
): Promise<{ orden: Orden } | { error: string }> {
  const { data, error } = await db()
    .from("ordenes")
    .update({ estado: "rechazado" })
    .eq("id", ordenId)
    .eq("estado", "pendiente")
    .select()
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Orden no encontrada o no está pendiente" };
  return { orden: mapOrden(data) };
}

export async function getOrden(ordenId: string): Promise<Orden | null> {
  const { data } = await db()
    .from("ordenes")
    .select("*")
    .eq("id", ordenId)
    .maybeSingle();
  return data ? mapOrden(data) : null;
}

export async function getTicketsByOrden(ordenId: string): Promise<Ticket[]> {
  const { data } = await db()
    .from("tickets")
    .select("*")
    .eq("orden_id", ordenId)
    .order("numero_entrada");
  return (data ?? []).map(mapTicket);
}

export async function verifyTicket(ticketId: string): Promise<VerifyResult> {
  const { data: updated, error } = await db()
    .from("tickets")
    .update({ usado: true, usado_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("usado", false)
    .eq("cancelado", false)
    .select()
    .maybeSingle();

  if (error) return { status: "invalido", message: "Error al verificar" };

  if (updated) {
    const ticket = mapTicket(updated);
    await logActivity(
      "ingreso",
      `Ingreso: ${ticket.compradorNombre} (entrada ${ticket.numeroEntrada}/${ticket.totalEntradas})`
    );
    return {
      status: "valido",
      ticket,
      message: "Entrada válida — bienvenido/a",
    };
  }

  const { data: existing } = await db()
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();

  if (!existing) return { status: "invalido", message: "Entrada no válida" };

  const ticket = mapTicket(existing);
  if (ticket.cancelado) {
    return {
      status: "cancelada",
      ticket,
      message: "Entrada cancelada / reembolsada",
    };
  }
  if (ticket.usado) {
    return {
      status: "usada",
      ticket,
      message: `Ya ingresó${ticket.usadoAt ? ` a las ${new Date(ticket.usadoAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}`,
    };
  }

  return { status: "invalido", message: "Entrada no válida" };
}

export async function cancelTicket(
  ticketId: string,
  motivo?: string
): Promise<{ ticket: Ticket } | { error: string }> {
  const { data, error } = await db()
    .from("tickets")
    .update({
      cancelado: true,
      cancelado_at: new Date().toISOString(),
      motivo_cancelacion: motivo ?? null,
    })
    .eq("id", ticketId)
    .eq("cancelado", false)
    .select()
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Ticket no encontrado o ya cancelado" };

  const ticket = mapTicket(data);
  await logActivity(
    "baja",
    `Baja: ${ticket.compradorNombre} (entrada ${ticket.numeroEntrada}/${ticket.totalEntradas})`
  );
  return { ticket };
}

export async function refundOrden(
  ordenId: string
): Promise<{ orden: Orden } | { error: string }> {
  const orden = await getOrden(ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  if (orden.estado === "reembolsado") return { error: "Ya reembolsada" };
  if (orden.estado !== "aprobado") return { error: "Solo órdenes aprobadas" };

  await db()
    .from("tickets")
    .update({
      cancelado: true,
      cancelado_at: new Date().toISOString(),
      motivo_cancelacion: "Reembolso de orden",
    })
    .eq("orden_id", ordenId)
    .eq("cancelado", false);

  const { data, error } = await db()
    .from("ordenes")
    .update({ estado: "reembolsado" })
    .eq("id", ordenId)
    .select()
    .single();

  if (error) return { error: error.message };

  await logActivity(
    "reembolso",
    `Reembolso: ${orden.compradorNombre}, $${orden.montoTotal.toLocaleString("es-AR")}`
  );

  return { orden: mapOrden(data) };
}

export async function getOrdenes(): Promise<Orden[]> {
  const { data } = await db()
    .from("ordenes")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapOrden);
}

export async function getTickets(): Promise<Ticket[]> {
  const { data } = await db()
    .from("tickets")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapTicket);
}

export async function getActivity(): Promise<ActivityLog[]> {
  const { data } = await db()
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map(mapActivity);
}

export async function getAdminStats(): Promise<AdminStats> {
  const evento = await getEventoActivo();
  const tickets = await getTickets();
  const ordenes = await getOrdenes();

  const activas = tickets.filter((t) => !t.cancelado);
  const canceladas = tickets.filter((t) => t.cancelado);
  const sinUsar = activas.filter((t) => !t.usado);
  const ingresaron = activas.filter((t) => t.usado);

  const recaudado = ordenes
    .filter((o) => o.estado === "aprobado")
    .reduce((sum, o) => sum + o.montoTotal, 0);

  const reembolsado = ordenes
    .filter((o) => o.estado === "reembolsado")
    .reduce((sum, o) => sum + o.montoTotal, 0);

  return {
    vendidasActivas: activas.length,
    recaudado,
    sinUsar: sinUsar.length,
    ingresaron: ingresaron.length,
    canceladas: canceladas.length,
    reembolsado,
    capacidad: evento?.capacidad ?? 0,
    disponibles: (evento?.capacidad ?? 0) - activas.length,
    totalOrdenes: ordenes.filter((o) => o.estado === "aprobado").length,
  };
}
