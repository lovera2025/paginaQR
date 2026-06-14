import { v4 as uuidv4 } from "uuid";
import { SEED_EVENTO } from "./seed";
import { sendOrderConfirmationEmail } from "@/lib/email/send";
import type {
  ActivityLog,
  AdminStats,
  Evento,
  Orden,
  Ticket,
  VerifyResult,
} from "@/types";

interface MockStore {
  evento: Evento;
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
      ordenes: [],
      tickets: [],
      activity: [],
    };
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
  store.evento = { ...store.evento, ...data };
  return store.evento;
}

export function countTicketsActivos(): number {
  return getStore().tickets.filter((t) => !t.cancelado).length;
}

export function createOrdenPendiente(input: {
  compradorNombre: string;
  compradorEmail: string;
  cantidad: number;
}): { orden: Orden } | { error: string } {
  const store = getStore();
  const evento = store.evento;

  if (!evento.activo) return { error: "No hay evento activo" };
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
    mpPaymentId: null,
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

export async function approveOrden(ordenId: string): Promise<{ orden: Orden; tickets: Ticket[] } | { error: string }> {
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
  orden.mpPaymentId = `mock_${orden.id.slice(0, 8)}`;

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
  return [...getStore().ordenes];
}

export function getTickets(): Ticket[] {
  return [...getStore().tickets];
}

export function getActivity(): ActivityLog[] {
  return [...getStore().activity];
}

export function getAdminStats(): AdminStats {
  const store = getStore();
  const tickets = store.tickets;
  const activas = tickets.filter((t) => !t.cancelado);
  const canceladas = tickets.filter((t) => t.cancelado);
  const sinUsar = activas.filter((t) => !t.usado);
  const ingresaron = activas.filter((t) => t.usado);

  const recaudado = store.ordenes
    .filter((o) => o.estado === "aprobado")
    .reduce((sum, o) => sum + o.montoTotal, 0);

  const reembolsado = store.ordenes
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
    totalOrdenes: store.ordenes.filter((o) => o.estado === "aprobado").length,
  };
}
