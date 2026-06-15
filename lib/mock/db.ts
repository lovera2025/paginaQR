import { v4 as uuidv4 } from "uuid";
import { SEED_EVENTO } from "./seed";
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

interface MockStore {
  evento: Evento;
  eventosPasados: Evento[];
  ordenes: Orden[];
  tickets: Ticket[];
  activity: ActivityLog[];
}

declare global {
  // eslint-disable-next-line no-var
  var __mockStore: MockStore | undefined;
}

function getStore(): MockStore {
  if (!global.__mockStore) {
    global.__mockStore = {
      evento: { ...SEED_EVENTO },
      eventosPasados: [],
      ordenes: [],
      tickets: [],
      activity: [],
    };
  }
  if (!global.__mockStore.evento.estado) {
    global.__mockStore.evento.estado = "borrador";
  }
  if (!global.__mockStore.eventosPasados) {
    global.__mockStore.eventosPasados = [];
  }
  return global.__mockStore;
}

function logActivity(tipo: ActivityLog["tipo"], mensaje: string) {
  const store = getStore();
  store.activity.unshift({
    id: uuidv4(),
    tipo,
    mensaje,
    createdAt: new Date().toISOString(),
  });
  if (store.activity.length > 100) store.activity.pop();
}

export function getEventoActivo(): Evento | null {
  const { evento } = getStore();
  return evento.activo ? evento : null;
}

export function updateEvento(data: Partial<Evento>): Evento {
  const store = getStore();
  const appearance = { ...data };
  delete appearance.estado;
  delete appearance.activo;
  delete appearance.id;
  store.evento = { ...store.evento, ...appearance };
  return store.evento;
}

export function countTicketsActivos(): number {
  const { evento, tickets } = getStore();
  return tickets.filter((t) => t.eventoId === evento.id && !t.cancelado).length;
}

export function createOrdenPendiente(input: {
  compradorNombre: string;
  compradorEmail: string;
  cantidad: number;
}): { orden: Orden } | { error: string } {
  const store = getStore();
  const evento = store.evento;

  if (!evento.activo) return { error: "No hay evento activo" };
  if (!canComprarPublico(evento.estado))
    return { error: "Las ventas están cerradas para este evento" };
  if (input.cantidad < 1 || input.cantidad > 10)
    return { error: "Cantidad inválida (1-10)" };
  if (!input.compradorNombre.trim() || !input.compradorEmail.trim())
    return { error: "Nombre y email son obligatorios" };

  const activos = countTicketsActivos();
  if (activos + input.cantidad > evento.capacidad)
    return { error: `Solo quedan ${evento.capacidad - activos} entradas` };

  const orden: Orden = {
    id: uuidv4(),
    eventoId: evento.id,
    paymentId: null,
    compradorNombre: input.compradorNombre.trim(),
    compradorEmail: input.compradorEmail.trim().toLowerCase(),
    cantidad: input.cantidad,
    montoTotal: evento.precio * input.cantidad,
    estado: "pendiente",
    createdAt: new Date().toISOString(),
    emailSentAt: null,
  };

  store.ordenes.unshift(orden);
  return { orden };
}

function createTicketsForOrden(orden: Orden): Ticket[] {
  const created: Ticket[] = [];
  for (let i = 1; i <= orden.cantidad; i++) {
    const ticket: Ticket = {
      id: uuidv4(),
      ordenId: orden.id,
      eventoId: orden.eventoId,
      compradorNombre: orden.compradorNombre,
      compradorEmail: orden.compradorEmail,
      numeroEntrada: i,
      totalEntradas: orden.cantidad,
      usado: false,
      cancelado: false,
      usadoAt: null,
      canceladoAt: null,
      motivoCancelacion: null,
      createdAt: new Date().toISOString(),
    };
    created.push(ticket);
  }
  return created;
}

async function trySendConfirmationEmail(
  orden: Orden,
  tickets: Ticket[],
  evento: Evento
): Promise<Orden> {
  const result = await sendOrderConfirmationEmail({ orden, tickets, evento });
  if (!result.sent) return orden;
  orden.emailSentAt = new Date().toISOString();
  return orden;
}

export function getOrdenByPaymentId(paymentId: string): Orden | null {
  return (
    getStore().ordenes.find((o) => o.paymentId === paymentId) ?? null
  );
}

export function setOrdenPaymentId(
  ordenId: string,
  paymentId: string
): { ok: true } | { error: string } {
  const orden = getStore().ordenes.find((o) => o.id === ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  if (orden.estado !== "pendiente") return { error: "Orden no está pendiente" };
  orden.paymentId = paymentId;
  return { ok: true };
}

export async function approveOrden(
  ordenId: string,
  paymentId?: string
): Promise<{ orden: Orden; tickets: Ticket[] } | { error: string }> {
  const store = getStore();
  const orden = store.ordenes.find((o) => o.id === ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  if (orden.estado === "aprobado") {
    const existing = store.tickets.filter((t) => t.ordenId === ordenId);
    if (existing.length > 0) {
      const ordenWithEmail = await trySendConfirmationEmail(
        orden,
        existing,
        store.evento
      );
      return { orden: ordenWithEmail, tickets: existing };
    }
    return { orden, tickets: existing };
  }
  if (orden.estado !== "pendiente") return { error: "Orden no está pendiente" };

  const activos = countTicketsActivos();
  if (activos + orden.cantidad > store.evento.capacidad)
    return { error: "Capacidad agotada" };

  orden.estado = "aprobado";
  orden.paymentId = paymentId ?? `mock_${orden.id.slice(0, 8)}`;

  const tickets = createTicketsForOrden(orden);
  store.tickets.unshift(...tickets);

  logActivity(
    "venta",
    `Venta: ${orden.compradorNombre}, ${orden.cantidad} entrada(s), $${orden.montoTotal.toLocaleString("es-AR")}`
  );

  const ordenWithEmail = await trySendConfirmationEmail(orden, tickets, store.evento);

  return { orden: ordenWithEmail, tickets };
}

export function rejectOrden(ordenId: string): { orden: Orden } | { error: string } {
  const store = getStore();
  const orden = store.ordenes.find((o) => o.id === ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  if (orden.estado !== "pendiente") return { error: "Orden no está pendiente" };
  orden.estado = "rechazado";
  return { orden };
}

export function getOrden(ordenId: string): Orden | undefined {
  return getStore().ordenes.find((o) => o.id === ordenId);
}

export function getTicketsByOrden(ordenId: string): Ticket[] {
  return getStore().tickets.filter((t) => t.ordenId === ordenId);
}

export function getTicket(ticketId: string): Ticket | undefined {
  return getStore().tickets.find((t) => t.id === ticketId);
}

export function verifyTicket(ticketId: string): VerifyResult {
  const store = getStore();
  const ticket = store.tickets.find((t) => t.id === ticketId);

  if (!ticket) {
    return { status: "invalido", message: "Entrada no válida" };
  }
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

  ticket.usado = true;
  ticket.usadoAt = new Date().toISOString();

  logActivity(
    "ingreso",
    `Ingreso: ${ticket.compradorNombre} (entrada ${ticket.numeroEntrada}/${ticket.totalEntradas})`
  );

  return {
    status: "valido",
    ticket,
    message: "Entrada válida — bienvenido/a",
  };
}

export function cancelTicket(
  ticketId: string,
  motivo?: string
): { ticket: Ticket } | { error: string } {
  const store = getStore();
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) return { error: "Ticket no encontrado" };
  if (ticket.cancelado) return { error: "Ya está cancelado" };

  ticket.cancelado = true;
  ticket.canceladoAt = new Date().toISOString();
  ticket.motivoCancelacion = motivo ?? null;

  logActivity(
    "baja",
    `Baja: ${ticket.compradorNombre} (entrada ${ticket.numeroEntrada}/${ticket.totalEntradas})`
  );

  return { ticket };
}

export function refundOrden(ordenId: string): { orden: Orden } | { error: string } {
  const store = getStore();
  const orden = store.ordenes.find((o) => o.id === ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  if (orden.estado === "reembolsado") return { error: "Ya reembolsada" };
  if (orden.estado !== "aprobado") return { error: "Solo órdenes aprobadas" };

  const tickets = store.tickets.filter((t) => t.ordenId === ordenId);
  for (const t of tickets) {
    if (!t.cancelado) {
      t.cancelado = true;
      t.canceladoAt = new Date().toISOString();
      t.motivoCancelacion = "Reembolso de orden";
    }
  }

  orden.estado = "reembolsado";

  logActivity(
    "reembolso",
    `Reembolso: ${orden.compradorNombre}, $${orden.montoTotal.toLocaleString("es-AR")}`
  );

  return { orden };
}

export function getOrdenes(): Orden[] {
  const { evento, ordenes } = getStore();
  if (!evento.activo) return [];
  return ordenes.filter((o) => o.eventoId === evento.id);
}

export function getTickets(): Ticket[] {
  const { evento, tickets } = getStore();
  if (!evento.activo) return [];
  return tickets.filter((t) => t.eventoId === evento.id);
}

export function getActivity(): ActivityLog[] {
  return [...getStore().activity];
}

export function getAdminStats(): AdminStats {
  const store = getStore();
  if (!store.evento.activo) {
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
  const tickets = getTickets();
  const activas = tickets.filter((t) => !t.cancelado);
  const canceladas = tickets.filter((t) => t.cancelado);
  const sinUsar = activas.filter((t) => !t.usado);
  const ingresaron = activas.filter((t) => t.usado);

  const recaudado = getOrdenes()
    .filter((o) => o.estado === "aprobado")
    .reduce((sum, o) => sum + o.montoTotal, 0);

  const reembolsado = getOrdenes()
    .filter((o) => o.estado === "reembolsado")
    .reduce((sum, o) => sum + o.montoTotal, 0);

  return {
    vendidasActivas: activas.length,
    recaudado,
    sinUsar: sinUsar.length,
    ingresaron: ingresaron.length,
    canceladas: canceladas.length,
    reembolsado,
    capacidad: store.evento.capacidad,
    disponibles: store.evento.capacidad - activas.length,
    totalOrdenes: getOrdenes().filter((o) => o.estado === "aprobado").length,
  };
}

export function resetVentasEventoActivo(): { ok: true } | { error: string } {
  const store = getStore();
  if (!store.evento.activo) return { error: "No hay evento activo" };
  if (store.evento.estado !== "borrador") {
    return { error: "Solo se puede reiniciar ventas en borrador (modo prueba)" };
  }

  const eventoId = store.evento.id;
  store.ordenes = store.ordenes.filter((o) => o.eventoId !== eventoId);
  store.tickets = store.tickets.filter((t) => t.eventoId !== eventoId);
  store.activity = [];

  return { ok: true };
}

export function abrirVentaEvento(): { evento: Evento } | { error: string } {
  const store = getStore();
  if (!store.evento.activo) return { error: "No hay evento activo" };
  if (store.evento.estado !== "borrador") {
    return { error: "Solo se puede abrir venta desde borrador" };
  }
  store.evento.estado = "venta";
  return { evento: store.evento };
}

export function cerrarEventoActivo(): { evento: Evento } | { error: string } {
  const store = getStore();
  if (!store.evento.activo) return { error: "No hay evento activo" };
  if (store.evento.estado !== "venta") {
    return { error: "Solo se puede cerrar un evento en venta" };
  }

  for (const orden of store.ordenes) {
    if (orden.eventoId === store.evento.id && orden.estado === "pendiente") {
      orden.estado = "rechazado";
    }
  }

  store.evento.estado = "finalizado";
  store.evento.activo = false;

  // Guardar copia en historial
  store.eventosPasados.unshift({ ...store.evento });

  return { evento: store.evento };
}

export function getEventosFinalizados(): Evento[] {
  return getStore().eventosPasados;
}

export function getOrdenesByEvento(eventoId: string): Orden[] {
  return getStore().ordenes.filter((o) => o.eventoId === eventoId);
}

export function getTicketsByEvento(eventoId: string): Ticket[] {
  return getStore().tickets.filter((t) => t.eventoId === eventoId);
}

function computeStats(eventoId: string, capacidad: number): AdminStats {
  const store = getStore();
  const tickets = store.tickets.filter((t) => t.eventoId === eventoId);
  const ordenes = store.ordenes.filter((o) => o.eventoId === eventoId);
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

export function getHistorialItems(): HistorialItem[] {
  const store = getStore();
  return store.eventosPasados.map((ev) => ({
    evento: ev,
    stats: computeStats(ev.id, ev.capacidad),
  }));
}

export function crearNuevoEvento(
  input: NuevoEventoInput
): { evento: Evento } | { error: string } {
  const store = getStore();

  if (store.evento.activo) {
    return { error: "Ya hay un evento activo. Cerrá el actual antes de crear uno nuevo." };
  }

  if (!input.nombre.trim()) return { error: "El nombre es obligatorio" };
  if (!input.fecha) return { error: "La fecha es obligatoria" };
  if (input.precio <= 0) return { error: "El precio debe ser mayor a 0" };
  if (input.capacidad < 1) return { error: "La capacidad debe ser al menos 1" };

  const anterior = store.eventosPasados[0] ?? null;

  const nuevoEvento: Evento = {
    id: `evento-${Date.now()}`,
    nombre: input.nombre.trim(),
    fecha: input.fecha,
    precio: input.precio,
    capacidad: input.capacidad,
    activo: true,
    estado: "borrador",
    logoUrl: input.copiarBranding && anterior ? anterior.logoUrl : "",
    flyerUrl: input.copiarBranding && anterior ? anterior.flyerUrl : "",
    colorPrimario: input.copiarBranding && anterior ? anterior.colorPrimario : "#ff006e",
    colorSecundario: input.copiarBranding && anterior ? anterior.colorSecundario : "#8338ec",
    descripcion: "",
    lugar: "",
    mapsUrl: "",
    contactoWhatsapp: input.copiarBranding && anterior ? anterior.contactoWhatsapp : "",
    contactoEmail: input.copiarBranding && anterior ? anterior.contactoEmail : "",
    contactoInstagram: input.copiarBranding && anterior ? anterior.contactoInstagram : "",
    textoFooter: input.copiarBranding && anterior ? anterior.textoFooter : "",
    organizadorNombre: input.copiarBranding && anterior ? anterior.organizadorNombre : "",
  };

  store.evento = nuevoEvento;
  store.activity = [];

  return { evento: nuevoEvento };
}
