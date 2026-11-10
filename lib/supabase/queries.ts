import { createServerClient } from "./server";
import {
  mapActivity,
  mapBranding,
  mapBrandingToRow,
  mapEvento,
  mapEventoToRow,
  mapOrden,
  mapTicket,
  mapTipo,
  mapTipoToRow,
} from "./mappers";
import { canComprarPublico } from "@/lib/evento/estado";
import { mensajeCancelada, prepararAnulacion, textoAnulacion } from "@/lib/entradas/anulaciones";
import {
  buildCatalogo,
  computeStats,
  evaluarTipos,
  fiestaEnProximamente,
  horaAr,
  ordenarTipos,
  RESERVA_MINUTOS,
  reservasVigentes,
  uniqueSlug,
  validarCompraTipo,
  validarDatosComprador,
  type Reserva,
  type TicketConteo,
} from "@/lib/entradas/tipos";
import { SEED_BRANDING } from "@/lib/mock/seed";
import type { OrdenRow, TicketRow } from "./types";
import { traerTodo } from "./paginar";
import type {
  ActivityLog,
  AdminStats,
  Branding,
  Evento,
  EventoCatalogo,
  HistorialItem,
  ModoPago,
  NuevoEventoInput,
  Orden,
  OrdenProblema,
  PaymentMethod,
  Ticket,
  TipoEntrada,
  TipoEntradaDisponible,
  TipoEntradaInput,
  VerifyResult,
} from "@/types";

function db() {
  const client = createServerClient();
  if (!client) throw new Error("Supabase no configurado");
  return client;
}

export async function logActivity(tipo: ActivityLog["tipo"], mensaje: string) {
  await db().from("activity_log").insert({ tipo, mensaje });
}

// ─── Eventos ─────────────────────────────────────────────────────────────

export async function getEventosPublicados(): Promise<Evento[]> {
  const { data } = await db()
    .from("eventos")
    .select("*")
    .in("estado", ["venta", "pausado"])
    .order("fecha", { ascending: true });
  return (data ?? []).map(mapEvento);
}

export async function getEventosAdmin(): Promise<Evento[]> {
  const { data } = await db()
    .from("eventos")
    .select("*")
    .neq("estado", "finalizado")
    .order("fecha", { ascending: true });
  return (data ?? []).map(mapEvento);
}

export async function getEventoById(eventoId: string): Promise<Evento | null> {
  const { data, error } = await db().from("eventos").select("*").eq("id", eventoId).maybeSingle();
  if (error || !data) return null;
  return mapEvento(data);
}

export async function getEventoBySlug(slug: string): Promise<Evento | null> {
  const { data, error } = await db().from("eventos").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return mapEvento(data);
}

async function getTiposDeEventos(eventoIds: string[]): Promise<TipoEntrada[]> {
  if (eventoIds.length === 0) return [];
  const { data } = await db().from("tipos_entrada").select("*").in("evento_id", eventoIds);
  return (data ?? []).map(mapTipo);
}

/**
 * Lo mínimo de cada entrada para contar vendidas y cupos (se pide en cada visita a la portada:
 * traer solo estas columnas hace la consulta mucho más liviana que la fila entera).
 */
async function getTicketsDeEventos(eventoIds: string[]): Promise<TicketConteo[]> {
  if (eventoIds.length === 0) return [];
  const rows = await traerTodo<Pick<TicketRow, "evento_id" | "tipo_entrada_id" | "cancelado">>((desde, hasta) =>
    db()
      .from("tickets")
      .select("id,evento_id,tipo_entrada_id,cancelado")
      .in("evento_id", eventoIds)
      .order("id")
      .range(desde, hasta)
  );
  return rows.map((r) => ({ eventoId: r.evento_id, tipoEntradaId: r.tipo_entrada_id ?? null, cancelado: r.cancelado }));
}

/** Compras sin pagar de los últimos minutos: guardan lugar mientras dura la reserva. */
async function getReservasDeEventos(eventoIds: string[]): Promise<(Reserva & { eventoId: string })[]> {
  if (eventoIds.length === 0) return [];
  const now = new Date();
  const desde = new Date(now.getTime() - RESERVA_MINUTOS * 60_000).toISOString();
  // select("*"): si la columna `problema` todavía no existe, la consulta igual funciona.
  const rows = await traerTodo<OrdenRow>((a, b) =>
    db()
      .from("ordenes")
      .select("*")
      .in("evento_id", eventoIds)
      .eq("estado", "pendiente")
      .gte("created_at", desde)
      .order("id")
      .range(a, b)
  );
  const ordenes = rows.map(mapOrden);
  return ordenes.flatMap((o) => reservasVigentes([o], now).map((r) => ({ ...r, eventoId: o.eventoId })));
}

export async function getCatalogo(): Promise<EventoCatalogo[]> {
  const eventos = await getEventosPublicados();
  const ids = eventos.map((e) => e.id);
  const [tipos, tickets, reservas] = await Promise.all([
    getTiposDeEventos(ids),
    getTicketsDeEventos(ids),
    getReservasDeEventos(ids),
  ]);
  return eventos.map((ev) =>
    buildCatalogo(
      ev,
      tipos.filter((t) => t.eventoId === ev.id),
      tickets.filter((t) => t.eventoId === ev.id),
      new Date(),
      reservas.filter((r) => r.eventoId === ev.id)
    )
  );
}

export async function getEventoCatalogo(eventoId: string): Promise<EventoCatalogo | null> {
  const ev = await getEventoById(eventoId);
  if (!ev) return null;
  const [tipos, tickets, reservas] = await Promise.all([
    getTiposDeEventos([ev.id]),
    getTicketsDeEventos([ev.id]),
    getReservasDeEventos([ev.id]),
  ]);
  return buildCatalogo(ev, tipos, tickets, new Date(), reservas);
}

export async function updateEvento(
  eventoId: string,
  data: Partial<Evento>
): Promise<Evento | { error: string }> {
  const cambios = { ...data };
  delete cambios.estado;
  delete cambios.activo;
  delete cambios.id;

  if (cambios.slug !== undefined) {
    const { data: otro } = await db()
      .from("eventos")
      .select("id")
      .eq("slug", cambios.slug)
      .neq("id", eventoId)
      .maybeSingle();
    if (otro) return { error: "Ese link ya lo usa otra fiesta" };
  }

  const { data: updated, error } = await db()
    .from("eventos")
    .update(mapEventoToRow(cambios))
    .eq("id", eventoId)
    .select()
    .single();
  if (error) return { error: error.message };
  return mapEvento(updated);
}

// ─── Tipos de entrada ────────────────────────────────────────────────────

export async function getTiposByEvento(eventoId: string): Promise<TipoEntrada[]> {
  return ordenarTipos(await getTiposDeEventos([eventoId]));
}

export async function getTiposDisponibles(eventoId: string): Promise<TipoEntradaDisponible[]> {
  const ev = await getEventoById(eventoId);
  if (!ev) return [];
  const [tipos, tickets, reservas] = await Promise.all([
    getTiposDeEventos([eventoId]),
    getTicketsDeEventos([eventoId]),
    getReservasDeEventos([eventoId]),
  ]);
  return evaluarTipos(ev, tipos, tickets, new Date(), reservas);
}

export async function getTipoById(tipoId: string): Promise<TipoEntrada | null> {
  const { data } = await db().from("tipos_entrada").select("*").eq("id", tipoId).maybeSingle();
  return data ? mapTipo(data) : null;
}

export async function createTipo(
  eventoId: string,
  input: TipoEntradaInput
): Promise<TipoEntrada | { error: string }> {
  const { data, error } = await db()
    .from("tipos_entrada")
    .insert({ ...mapTipoToRow(input), evento_id: eventoId })
    .select()
    .single();
  if (error) return { error: error.message };
  return mapTipo(data);
}

export async function updateTipo(
  tipoId: string,
  input: Partial<TipoEntradaInput>
): Promise<TipoEntrada | { error: string }> {
  const { data, error } = await db()
    .from("tipos_entrada")
    .update(mapTipoToRow(input))
    .eq("id", tipoId)
    .select()
    .single();
  if (error) return { error: error.message };
  return mapTipo(data);
}

export async function deleteTipo(tipoId: string): Promise<{ ok: true } | { error: string }> {
  const { count } = await db()
    .from("ordenes")
    .select("id", { count: "exact", head: true })
    .eq("tipo_entrada_id", tipoId);
  if ((count ?? 0) > 0) return { error: "Este tipo ya tiene compras: desactivalo en lugar de borrarlo" };
  const { error } = await db().from("tipos_entrada").delete().eq("id", tipoId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function reordenarTipos(eventoId: string, ids: string[]): Promise<{ ok: true }> {
  await Promise.all(
    ids.map((id, i) =>
      db().from("tipos_entrada").update({ orden: i }).eq("id", id).eq("evento_id", eventoId)
    )
  );
  return { ok: true };
}

// ─── Órdenes ─────────────────────────────────────────────────────────────

export async function createOrdenPendiente(input: {
  eventoId: string;
  tipoEntradaId: string;
  compradorNombre: string;
  compradorEmail: string;
  cantidad: number;
}): Promise<{ orden: Orden } | { error: string }> {
  const evento = await getEventoById(input.eventoId);
  if (!evento) return { error: "Fiesta no encontrada" };
  if (!canComprarPublico(evento.estado)) {
    if (evento.estado === "pausado") return { error: "Las ventas están pausadas temporalmente" };
    return { error: "Las ventas están cerradas para esta fiesta" };
  }
  if (fiestaEnProximamente(evento)) return { error: "La venta de esta fiesta todavía no abrió" };
  if (!Number.isInteger(input.cantidad) || input.cantidad < 1 || input.cantidad > 10)
    return { error: "Cantidad inválida (1-10)" };
  const datosInvalidos = validarDatosComprador(input.compradorNombre, input.compradorEmail);
  if (datosInvalidos) return { error: datosInvalidos };

  const disponible = (await getTiposDisponibles(evento.id)).find((t) => t.id === input.tipoEntradaId);
  const problema = validarCompraTipo(disponible, input.cantidad);
  if (problema || !disponible) return { error: problema ?? "Tipo no disponible" };

  const { data, error } = await db()
    .from("ordenes")
    .insert({
      evento_id: evento.id,
      tipo_entrada_id: disponible.id,
      tipo_nombre: disponible.nombre,
      precio_unitario: disponible.precio,
      comprador_nombre: input.compradorNombre.trim(),
      comprador_email: input.compradorEmail.trim().toLowerCase(),
      cantidad: input.cantidad,
      monto_total: disponible.precio * input.cantidad,
      estado: "pendiente",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { orden: mapOrden(data) };
}

export async function getOrdenByPaymentId(paymentId: string): Promise<Orden | null> {
  const { data } = await db().from("ordenes").select("*").eq("mp_payment_id", paymentId).maybeSingle();
  return data ? mapOrden(data) : null;
}

export async function setOrdenPaymentId(
  ordenId: string,
  paymentId: string,
  paymentMethod?: PaymentMethod
): Promise<{ ok: true } | { error: string }> {
  const update: Record<string, string> = { mp_payment_id: paymentId };
  if (paymentMethod) update.payment_method = paymentMethod;
  const { error } = await db().from("ordenes").update(update).eq("id", ordenId).eq("estado", "pendiente");
  if (error) return { error: error.message };
  return { ok: true };
}

export async function approveOrden(
  ordenId: string,
  paymentId?: string,
  paymentMethod?: PaymentMethod,
  modoPago: ModoPago = "simulado"
): Promise<{ orden: Orden; tickets: Ticket[]; nueva: boolean } | { error: string; sinCupo?: boolean }> {
  const { data: ordenRow, error: ordenError } = await db()
    .from("ordenes")
    .select("*")
    .eq("id", ordenId)
    .single();
  if (ordenError || !ordenRow) return { error: "Orden no encontrada" };
  const orden = mapOrden(ordenRow);

  if (orden.estado === "aprobado") {
    return { orden, tickets: await getTicketsByOrden(ordenId), nueva: false };
  }
  if (orden.estado !== "pendiente") return { error: "Orden no está pendiente" };

  const evento = await getEventoById(orden.eventoId);
  if (!evento) return { error: "Fiesta no encontrada" };
  const activos = (await getTicketsDeEventos([evento.id])).filter((t) => !t.cancelado);
  if (activos.length + orden.cantidad > evento.capacidad) return { error: "Capacidad agotada", sinCupo: true };

  const tipo = orden.tipoEntradaId ? await getTipoById(orden.tipoEntradaId) : null;
  if (tipo?.cupo != null) {
    const vendidasTipo = activos.filter((t) => t.tipoEntradaId === tipo.id).length;
    if (vendidasTipo + orden.cantidad > tipo.cupo) return { error: `Cupo ${tipo.nombre} agotado`, sinCupo: true };
  }

  const resolvedPaymentId = paymentId ?? `mock_${orden.id.slice(0, 8)}`;
  const resolvedMethod = paymentMethod ?? orden.paymentMethod ?? null;

  // Paso atómico: solo un proceso puede pasar la orden de pendiente a aprobado.
  const { data: claimed, error: updateError } = await db()
    .from("ordenes")
    .update({
      estado: "aprobado",
      mp_payment_id: resolvedPaymentId,
      payment_method: resolvedMethod,
      modo_pago: modoPago,
      // Si antes quedó marcada sin cupo y ahora se pudo emitir, el problema se resolvió.
      ...(orden.problema ? { problema: null } : {}),
    })
    .eq("id", ordenId)
    .eq("estado", "pendiente")
    .select()
    .maybeSingle();
  if (updateError) return { error: updateError.message };
  if (!claimed) {
    const actual = await getOrden(ordenId);
    if (actual?.estado === "aprobado") {
      return { orden: actual, tickets: await getTicketsByOrden(ordenId), nueva: false };
    }
    return { error: "Orden no está pendiente" };
  }

  const ticketRows = Array.from({ length: orden.cantidad }, (_, i) => ({
    orden_id: orden.id,
    evento_id: orden.eventoId,
    tipo_entrada_id: orden.tipoEntradaId,
    tipo_nombre: orden.tipoNombre,
    estilo: tipo?.estilo ?? "general",
    comprador_nombre: orden.compradorNombre,
    comprador_email: orden.compradorEmail,
    numero_entrada: i + 1,
    total_entradas: orden.cantidad,
  }));

  const { data: ticketsData, error: ticketsError } = await db().from("tickets").insert(ticketRows).select();
  if (ticketsError) {
    // Sin entradas la compra no puede quedar aprobada: se vuelve a pendiente para reintentar.
    await db().from("ordenes").update({ estado: "pendiente" }).eq("id", ordenId).eq("estado", "aprobado");
    return { error: ticketsError.message };
  }

  await logActivity(
    "venta",
    `Venta ${evento.slug}: ${orden.compradorNombre}, ${orden.cantidad} × ${orden.tipoNombre}, $${orden.montoTotal.toLocaleString("es-AR")}`
  );

  return {
    orden: mapOrden(claimed),
    tickets: (ticketsData ?? []).map(mapTicket).sort((a, b) => a.numeroEntrada - b.numeroEntrada),
    nueva: true,
  };
}

export async function rejectOrden(ordenId: string): Promise<{ orden: Orden } | { error: string }> {
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

/** Deja anotado en la compra que hay que resolverla a mano (ej. pago que entró sin cupo). */
export async function marcarProblemaOrden(
  ordenId: string,
  problema: OrdenProblema
): Promise<{ ok: true; nuevo: boolean } | { error: string }> {
  const { data, error } = await db()
    .from("ordenes")
    .update({ problema })
    .eq("id", ordenId)
    .is("problema", null)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  return { ok: true, nuevo: Boolean(data) };
}

/** El admin ya devolvió la plata de un pago que entró sin cupo: la compra queda cerrada como devuelta. */
export async function cerrarPagoSinCupo(ordenId: string): Promise<{ orden: Orden } | { error: string }> {
  const orden = await getOrden(ordenId);
  if (!orden) return { error: "Compra no encontrada" };
  if (orden.estado !== "pendiente" || orden.problema !== "pago_sin_cupo") {
    return { error: "Esta compra no es un pago sin cupo pendiente de devolver" };
  }
  const { data, error } = await db()
    .from("ordenes")
    .update({ estado: "reembolsado", monto_reembolsado: orden.montoTotal })
    .eq("id", ordenId)
    .eq("estado", "pendiente")
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "La compra cambió mientras tanto. Recargá y revisá." };
  return { orden: mapOrden(data) };
}

/** Una compra rechazada a la que igual le llegó un pago aprobado vuelve a pendiente para emitirse. */
export async function reabrirOrden(ordenId: string): Promise<{ orden: Orden } | { error: string }> {
  const { data, error } = await db()
    .from("ordenes")
    .update({ estado: "pendiente" })
    .eq("id", ordenId)
    .eq("estado", "rechazado")
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  const orden = data ? mapOrden(data) : await getOrden(ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  return { orden };
}

export async function getOrden(ordenId: string): Promise<Orden | null> {
  const { data } = await db().from("ordenes").select("*").eq("id", ordenId).maybeSingle();
  return data ? mapOrden(data) : null;
}

export async function getTicketsByOrden(ordenId: string): Promise<Ticket[]> {
  const { data } = await db().from("tickets").select("*").eq("orden_id", ordenId).order("numero_entrada");
  return (data ?? []).map(mapTicket);
}

export async function getTicket(ticketId: string): Promise<Ticket | null> {
  const { data } = await db().from("tickets").select("*").eq("id", ticketId).maybeSingle();
  return data ? mapTicket(data) : null;
}

export async function claimEmailSend(ordenId: string): Promise<boolean> {
  const { data } = await db()
    .from("ordenes")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", ordenId)
    .is("email_sent_at", null)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export async function releaseEmailSend(ordenId: string): Promise<void> {
  await db().from("ordenes").update({ email_sent_at: null }).eq("id", ordenId);
}

// ─── Puerta ──────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyTicket(ticketId: string, eventoId?: string): Promise<VerifyResult> {
  if (!UUID_RE.test(ticketId)) return { status: "invalido", message: "QR no reconocido" };

  const existing = await getTicket(ticketId);
  if (!existing) return { status: "invalido", message: "QR no reconocido" };

  const [evento, ordenModo] = await Promise.all([
    getEventoById(existing.eventoId),
    db().from("ordenes").select("modo_pago").eq("id", existing.ordenId).maybeSingle(),
  ]);
  const modo = (ordenModo.data as { modo_pago?: string | null } | null)?.modo_pago;
  const extra = {
    eventoNombre: evento?.nombre,
    eventoFecha: evento?.fecha,
    prueba: modo === "simulado" || modo === "sandbox",
  };

  if (eventoId && existing.eventoId !== eventoId) {
    return { status: "otro_evento", ticket: existing, ...extra, message: "Es de otra fiesta" };
  }

  // Marcado atómico: si dos celulares escanean a la vez, solo uno gana.
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
      `Ingreso ${evento?.slug ?? ""}: ${ticket.compradorNombre} · ${ticket.tipoNombre} (${ticket.numeroEntrada}/${ticket.totalEntradas})`
    );
    return { status: "valido", ticket, ...extra, message: "Entrada válida · bienvenido/a" };
  }

  const ticket = (await getTicket(ticketId)) ?? existing;
  if (ticket.cancelado) {
    return { status: "cancelada", ticket, ...extra, message: mensajeCancelada(ticket) };
  }
  return {
    status: "usada",
    ticket,
    ...extra,
    message: `Ya ingresó${ticket.usadoAt ? ` a las ${horaAr(ticket.usadoAt)} hs` : ""}`,
  };
}

export async function cancelTicket(
  ticketId: string,
  motivo?: string
): Promise<{ ticket: Ticket } | { error: string }> {
  const { data, error } = await db()
    .from("tickets")
    .update({ cancelado: true, cancelado_at: new Date().toISOString(), motivo_cancelacion: motivo ?? null })
    .eq("id", ticketId)
    .eq("cancelado", false)
    .select()
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Ticket no encontrado o ya cancelado" };
  const ticket = mapTicket(data);
  await logActivity("baja", `Baja: ${ticket.compradorNombre} (entrada ${ticket.numeroEntrada}/${ticket.totalEntradas})`);
  return { ticket };
}

/** Anula entradas de una compra (a mano, después de hablar con el comprador). */
export async function anularTickets(input: {
  ordenId: string;
  ticketIds: string[];
  motivo: string;
  devolverPlata: boolean;
}): Promise<{ orden: Orden; tickets: Ticket[]; monto: number } | { error: string }> {
  const orden = await getOrden(input.ordenId);
  if (!orden) return { error: "Compra no encontrada" };
  if (orden.estado !== "aprobado") return { error: "Solo se pueden anular compras con pago aprobado" };
  const motivo = input.motivo.trim();
  if (!motivo) return { error: "Elegí el motivo de la anulación" };

  const tickets = await getTicketsByOrden(orden.id);
  const prep = prepararAnulacion(orden, tickets, input.ticketIds);
  if ("error" in prep) return prep;

  // Solo se anulan las que siguen sin usar y sin cancelar en este momento (dos admins a la vez, puerta).
  const { data: anuladasRows, error } = await db()
    .from("tickets")
    .update({
      cancelado: true,
      cancelado_at: new Date().toISOString(),
      motivo_cancelacion: `Anulación: ${motivo}`,
      reembolsado: input.devolverPlata,
    })
    .in(
      "id",
      prep.tickets.map((t) => t.id)
    )
    .eq("orden_id", orden.id)
    .eq("cancelado", false)
    .eq("usado", false)
    .select();
  if (error) return { error: error.message };
  const anuladas = (anuladasRows ?? []).map(mapTicket);
  if (anuladas.length === 0) return { error: "Esas entradas ya no se pueden anular (¿ingresaron recién?)" };

  const monto = input.devolverPlata ? Math.round(anuladas.length * orden.precioUnitario * 100) / 100 : 0;

  // Suma optimista del monto devuelto (reintenta si otro admin anuló al mismo tiempo).
  let actual = orden;
  for (let intento = 0; intento < 3; intento++) {
    const { count } = await db()
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("orden_id", orden.id)
      .eq("cancelado", false);
    const nuevoMonto = actual.montoReembolsado + monto;
    const cambios: Record<string, unknown> = { monto_reembolsado: nuevoMonto };
    if ((count ?? 0) === 0 && nuevoMonto > 0) cambios.estado = "reembolsado";
    const { data: upd } = await db()
      .from("ordenes")
      .update(cambios)
      .eq("id", orden.id)
      .eq("monto_reembolsado", actual.montoReembolsado)
      .select()
      .maybeSingle();
    if (upd) {
      actual = mapOrden(upd);
      break;
    }
    const releida = await getOrden(orden.id);
    if (!releida) break;
    actual = releida;
  }

  const evento = await getEventoById(orden.eventoId);
  await logActivity(
    input.devolverPlata ? "reembolso" : "baja",
    textoAnulacion(evento?.slug ?? "", orden, anuladas.length, monto, motivo)
  );
  return { orden: actual, tickets: anuladas, monto };
}

// ─── Admin ───────────────────────────────────────────────────────────────

export async function getOrdenes(eventoId: string): Promise<Orden[]> {
  const rows = await traerTodo<OrdenRow>((desde, hasta) =>
    db()
      .from("ordenes")
      .select("*")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(desde, hasta)
  );
  return rows.map(mapOrden);
}

export async function getTickets(eventoId: string): Promise<Ticket[]> {
  const rows = await traerTodo<TicketRow>((desde, hasta) =>
    db()
      .from("tickets")
      .select("*")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(desde, hasta)
  );
  return rows.map(mapTicket);
}

export async function getActivity(): Promise<ActivityLog[]> {
  const { data } = await db()
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map(mapActivity);
}

export async function getAdminStats(eventoId: string): Promise<AdminStats> {
  const [ev, tipos, ordenes, tickets] = await Promise.all([
    getEventoById(eventoId),
    getTiposByEvento(eventoId),
    getOrdenes(eventoId),
    getTickets(eventoId),
  ]);
  return computeStats({ capacidad: ev?.capacidad ?? 0 }, tipos, ordenes, tickets);
}

async function cambiarEstado(
  eventoId: string,
  desde: Evento["estado"][],
  hacia: Evento["estado"],
  mensaje: string,
  extra: Record<string, unknown> = {}
): Promise<{ evento: Evento } | { error: string }> {
  const ev = await getEventoById(eventoId);
  if (!ev) return { error: "Fiesta no encontrada" };
  if (!desde.includes(ev.estado)) return { error: mensaje };
  const { data, error } = await db()
    .from("eventos")
    .update({ estado: hacia, ...extra })
    .eq("id", eventoId)
    .in("estado", desde)
    .select()
    .single();
  if (error) return { error: error.message };
  return { evento: mapEvento(data) };
}

export async function resetVentas(eventoId: string): Promise<{ ok: true } | { error: string }> {
  const ev = await getEventoById(eventoId);
  if (!ev) return { error: "Fiesta no encontrada" };
  if (ev.estado !== "borrador") return { error: "Solo se puede reiniciar ventas en borrador (modo prueba)" };
  const { error } = await db().from("ordenes").delete().eq("evento_id", eventoId);
  if (error) return { error: error.message };
  return { ok: true };
}

export function abrirVenta(eventoId: string) {
  return cambiarEstado(eventoId, ["borrador"], "venta", "Solo se puede abrir venta desde borrador");
}

export function pausarVentas(eventoId: string) {
  return cambiarEstado(eventoId, ["venta"], "pausado", "Solo se pueden pausar ventas con la fiesta en venta");
}

export function reanudarVentas(eventoId: string) {
  return cambiarEstado(eventoId, ["pausado"], "venta", "Solo se pueden reanudar ventas desde pausado");
}

export async function cerrarEvento(eventoId: string): Promise<{ evento: Evento } | { error: string }> {
  // Las que quedaron "pago sin cupo" siguen pendientes hasta registrar la devolución.
  await db()
    .from("ordenes")
    .update({ estado: "rechazado" })
    .eq("evento_id", eventoId)
    .eq("estado", "pendiente")
    .is("problema", null);
  return cambiarEstado(
    eventoId,
    ["venta", "pausado"],
    "finalizado",
    "Solo se puede cerrar una fiesta en venta o pausada",
    { activo: false }
  );
}

export async function getEventosFinalizados(): Promise<Evento[]> {
  const { data } = await db()
    .from("eventos")
    .select("*")
    .eq("estado", "finalizado")
    .order("fecha", { ascending: false });
  return (data ?? []).map(mapEvento);
}

export async function getOrdenesByEvento(eventoId: string): Promise<Orden[]> {
  return getOrdenes(eventoId);
}

export async function getTicketsByEvento(eventoId: string): Promise<Ticket[]> {
  return getTickets(eventoId);
}

export async function getHistorialItems(): Promise<HistorialItem[]> {
  const eventos = await getEventosFinalizados();
  return Promise.all(eventos.map(async (ev) => ({ evento: ev, stats: await getAdminStats(ev.id) })));
}

export async function crearNuevoEvento(
  input: NuevoEventoInput
): Promise<{ evento: Evento } | { error: string }> {
  if (!input.nombre.trim()) return { error: "El nombre es obligatorio" };
  if (!input.fecha) return { error: "La fecha es obligatoria" };
  if (input.precio <= 0) return { error: "El precio debe ser mayor a 0" };
  if (input.capacidad < 1) return { error: "La capacidad debe ser al menos 1" };

  const [{ data: slugs }, branding] = await Promise.all([
    db().from("eventos").select("slug"),
    getBranding(),
  ]);
  const slug = uniqueSlug(
    input.nombre,
    (slugs ?? []).map((r: { slug: string | null }) => r.slug ?? "").filter(Boolean)
  );

  let base: Partial<Evento> = {
    logoUrl: branding.logoUrl,
    colorPrimario: branding.colorPrimario,
    colorSecundario: "#0b0b10",
    contactoWhatsapp: branding.contactoWhatsapp,
    contactoEmail: branding.contactoEmail,
    contactoInstagram: branding.contactoInstagram,
    textoFooter: branding.textoFooter,
    organizadorNombre: branding.nombre,
  };

  if (input.copiarBranding) {
    const { data: anterior } = await db()
      .from("eventos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anterior) {
      const a = mapEvento(anterior);
      base = {
        logoUrl: a.logoUrl,
        colorPrimario: a.colorPrimario,
        colorSecundario: a.colorSecundario,
        subtitulo: a.subtitulo,
        lugar: a.lugar,
        mapsUrl: a.mapsUrl,
        contactoWhatsapp: a.contactoWhatsapp,
        contactoEmail: a.contactoEmail,
        contactoInstagram: a.contactoInstagram,
        textoFooter: a.textoFooter,
        organizadorNombre: a.organizadorNombre,
      };
    }
  }

  const id = `evento-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await db()
    .from("eventos")
    .insert({
      ...mapEventoToRow({
        subtitulo: "",
        dj: "",
        flyerUrl: "",
        descripcion: "",
        lugar: "",
        mapsUrl: "",
        mensajePostergado: "",
        mensajeProximamente: "",
        proximamente: false,
        ventaAbre: null,
        ...base,
      }),
      id,
      slug,
      nombre: input.nombre.trim(),
      fecha: input.fecha,
      precio: input.precio,
      capacidad: input.capacidad,
      activo: true,
      estado: "borrador",
    })
    .select()
    .single();
  if (error) return { error: error.message };

  await db().from("tipos_entrada").insert({
    evento_id: id,
    nombre: "General",
    descripcion: "Acceso a la fiesta toda la noche.",
    beneficios: [],
    precio: input.precio,
    cupo: null,
    estilo: "general",
    color_acento: "",
    activo: true,
    orden: 0,
  });

  return { evento: mapEvento(data) };
}

// ─── Marca ───────────────────────────────────────────────────────────────

export async function getBranding(): Promise<Branding> {
  const { data, error } = await db().from("app_branding").select("*").eq("id", "default").maybeSingle();
  if (error || !data) return { ...SEED_BRANDING };
  return mapBranding(data);
}

export async function updateBranding(data: Partial<Branding>): Promise<Branding | { error: string }> {
  const { data: row, error } = await db()
    .from("app_branding")
    .upsert({ id: "default", ...mapBrandingToRow(data), updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) return { error: error.message };
  return mapBranding(row);
}
