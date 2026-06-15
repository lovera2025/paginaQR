import { createServerClient } from "./server";
import {
  mapActivity,
  mapEvento,
  mapEventoToRow,
  mapOrden,
  mapTicket,
} from "./mappers";
import { sendOrderConfirmationEmail } from "@/lib/email/send";
import { canComprarPublico } from "@/lib/evento/estado";
import type {
  ActivityLog,
  AdminStats,
  Evento,
  HistorialItem,
  NuevoEventoInput,
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

async function countTicketsActivos(eventoId: string): Promise<number> {
  const { count } = await db()
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("evento_id", eventoId)
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

  const appearance = { ...data };
  delete appearance.estado;
  delete appearance.activo;
  delete appearance.id;

  const { data: updated, error } = await db()
    .from("eventos")
    .update(mapEventoToRow(appearance))
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
  if (!canComprarPublico(evento.estado))
    return { error: "Las ventas están cerradas para este evento" };
  if (input.cantidad < 1 || input.cantidad > 10)
    return { error: "Cantidad inválida (1-10)" };
  if (!input.compradorNombre.trim() || !input.compradorEmail.trim())
    return { error: "Nombre y email son obligatorios" };

  const activos = await countTicketsActivos(evento.id);
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

export async function getOrdenByPaymentId(
  paymentId: string
): Promise<Orden | null> {
  const { data } = await db()
    .from("ordenes")
    .select("*")
    .eq("mp_payment_id", paymentId)
    .maybeSingle();
  return data ? mapOrden(data) : null;
}

export async function setOrdenPaymentId(
  ordenId: string,
  paymentId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await db()
    .from("ordenes")
    .update({ mp_payment_id: paymentId })
    .eq("id", ordenId)
    .eq("estado", "pendiente");

  if (error) return { error: error.message };
  return { ok: true };
}

export async function approveOrden(
  ordenId: string,
  paymentId?: string
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

  const evento = await getEventoActivo();
  if (!evento) return { error: "No hay evento activo" };
  const activos = await countTicketsActivos(evento.id);
  if (activos + orden.cantidad > evento.capacidad)
    return { error: "Capacidad agotada" };

  const resolvedPaymentId = paymentId ?? `mock_${orden.id.slice(0, 8)}`;
  const { error: updateError } = await db()
    .from("ordenes")
    .update({ estado: "aprobado", mp_payment_id: resolvedPaymentId })
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
  const updatedOrden = {
    ...orden,
    estado: "aprobado" as const,
    paymentId: resolvedPaymentId,
  };

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
  const evento = await getEventoActivo();
  if (!evento) return [];
  const { data } = await db()
    .from("ordenes")
    .select("*")
    .eq("evento_id", evento.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapOrden);
}

export async function getTickets(): Promise<Ticket[]> {
  const evento = await getEventoActivo();
  if (!evento) return [];
  const { data } = await db()
    .from("tickets")
    .select("*")
    .eq("evento_id", evento.id)
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
  if (!evento) {
    return {
      vendidasActivas: 0,
      recaudado: 0,
      sinUsar: 0,
      ingresaron: 0,
      canceladas: 0,
      reembolsado: 0,
      capacidad: 0,
      disponibles: 0,
      totalOrdenes: 0,
    };
  }
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

export async function resetVentasEventoActivo(): Promise<
  { ok: true } | { error: string }
> {
  const evento = await getEventoActivo();
  if (!evento) return { error: "No hay evento activo" };
  if (evento.estado !== "borrador") {
    return { error: "Solo se puede reiniciar ventas en borrador (modo prueba)" };
  }

  const { error: ordenesError } = await db()
    .from("ordenes")
    .delete()
    .eq("evento_id", evento.id);

  if (ordenesError) return { error: ordenesError.message };

  const { error: activityError } = await db()
    .from("activity_log")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");

  if (activityError) return { error: activityError.message };

  return { ok: true };
}

export async function abrirVentaEvento(): Promise<
  { evento: Evento } | { error: string }
> {
  const evento = await getEventoActivo();
  if (!evento) return { error: "No hay evento activo" };
  if (evento.estado !== "borrador") {
    return { error: "Solo se puede abrir venta desde borrador" };
  }

  const { data, error } = await db()
    .from("eventos")
    .update({ estado: "venta" })
    .eq("id", evento.id)
    .eq("estado", "borrador")
    .select()
    .single();

  if (error) return { error: error.message };
  return { evento: mapEvento(data) };
}

export async function cerrarEventoActivo(): Promise<
  { evento: Evento } | { error: string }
> {
  const evento = await getEventoActivo();
  if (!evento) return { error: "No hay evento activo" };
  if (evento.estado !== "venta") {
    return { error: "Solo se puede cerrar un evento en venta" };
  }

  await db()
    .from("ordenes")
    .update({ estado: "rechazado" })
    .eq("evento_id", evento.id)
    .eq("estado", "pendiente");

  const { data, error } = await db()
    .from("eventos")
    .update({ estado: "finalizado", activo: false })
    .eq("id", evento.id)
    .eq("estado", "venta")
    .select()
    .single();

  if (error) return { error: error.message };
  return { evento: mapEvento(data) };
}

export async function getEventosFinalizados(): Promise<Evento[]> {
  const { data } = await db()
    .from("eventos")
    .select("*")
    .eq("activo", false)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapEvento);
}

export async function getOrdenesByEvento(eventoId: string): Promise<Orden[]> {
  const { data } = await db()
    .from("ordenes")
    .select("*")
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapOrden);
}

export async function getTicketsByEvento(eventoId: string): Promise<Ticket[]> {
  const { data } = await db()
    .from("tickets")
    .select("*")
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapTicket);
}

async function computeStatsParaEvento(eventoId: string, capacidad: number): Promise<AdminStats> {
  const [ticketsRes, ordenesRes] = await Promise.all([
    db().from("tickets").select("*").eq("evento_id", eventoId),
    db().from("ordenes").select("*").eq("evento_id", eventoId),
  ]);
  const tickets = (ticketsRes.data ?? []).map(mapTicket);
  const ordenes = (ordenesRes.data ?? []).map(mapOrden);
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
    capacidad,
    disponibles: capacidad - activas.length,
    totalOrdenes: ordenes.filter((o) => o.estado === "aprobado").length,
  };
}

export async function getHistorialItems(): Promise<HistorialItem[]> {
  const eventos = await getEventosFinalizados();
  return Promise.all(
    eventos.map(async (ev) => ({
      evento: ev,
      stats: await computeStatsParaEvento(ev.id, ev.capacidad),
    }))
  );
}

export async function crearNuevoEvento(
  input: NuevoEventoInput
): Promise<{ evento: Evento } | { error: string }> {
  const activo = await getEventoActivo();
  if (activo) {
    return { error: "Ya hay un evento activo. Cerrá el actual antes de crear uno nuevo." };
  }

  if (!input.nombre.trim()) return { error: "El nombre es obligatorio" };
  if (!input.fecha) return { error: "La fecha es obligatoria" };
  if (input.precio <= 0) return { error: "El precio debe ser mayor a 0" };
  if (input.capacidad < 1) return { error: "La capacidad debe ser al menos 1" };

  let branding: Record<string, string> = {};
  if (input.copiarBranding) {
    const { data: anterior } = await db()
      .from("eventos")
      .select("*")
      .eq("activo", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anterior) {
      branding = {
        logo_url: anterior.logo_url ?? "",
        flyer_url: anterior.flyer_url ?? "",
        color_primario: anterior.color_primario ?? "#ff006e",
        color_secundario: anterior.color_secundario ?? "#8338ec",
        contacto_whatsapp: anterior.contacto_whatsapp ?? "",
        contacto_email: anterior.contacto_email ?? "",
        contacto_instagram: anterior.contacto_instagram ?? "",
        texto_footer: anterior.texto_footer ?? "",
        organizador_nombre: anterior.organizador_nombre ?? "",
      };
    }
  }

  const id = `evento-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await db()
    .from("eventos")
    .insert({
      id,
      nombre: input.nombre.trim(),
      fecha: input.fecha,
      precio: input.precio,
      capacidad: input.capacidad,
      activo: true,
      estado: "borrador",
      logo_url: branding.logo_url ?? "",
      flyer_url: branding.flyer_url ?? "",
      color_primario: branding.color_primario ?? "#ff006e",
      color_secundario: branding.color_secundario ?? "#8338ec",
      descripcion: "",
      lugar: "",
      maps_url: "",
      contacto_whatsapp: branding.contacto_whatsapp ?? "",
      contacto_email: branding.contacto_email ?? "",
      contacto_instagram: branding.contacto_instagram ?? "",
      texto_footer: branding.texto_footer ?? "",
      organizador_nombre: branding.organizador_nombre ?? "",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { evento: mapEvento(data) };
}
