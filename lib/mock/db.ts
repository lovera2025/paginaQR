import { v4 as uuidv4 } from "uuid";
import { buildSeed, SEED_BRANDING } from "./seed";
import { canComprarPublico } from "@/lib/evento/estado";
import {
  buildCatalogo,
  computeStats,
  evaluarTipos,
  fiestaEnProximamente,
  horaAr,
  ordenarTipos,
  uniqueSlug,
  validarCompraTipo,
  validarDatosComprador,
} from "@/lib/entradas/tipos";
import { mensajeCancelada, prepararAnulacion, textoAnulacion } from "@/lib/entradas/anulaciones";
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
  PaymentMethod,
  Ticket,
  TipoEntrada,
  TipoEntradaDisponible,
  TipoEntradaInput,
  VerifyResult,
} from "@/types";

interface MockStore {
  eventos: Evento[];
  tipos: TipoEntrada[];
  ordenes: Orden[];
  tickets: Ticket[];
  activity: ActivityLog[];
  branding: Branding;
}

declare global {
  // eslint-disable-next-line no-var
  var __mockStoreV2: MockStore | undefined;
}

function getStore(): MockStore {
  if (!global.__mockStoreV2) {
    const seed = buildSeed();
    global.__mockStoreV2 = {
      eventos: seed.eventos,
      tipos: seed.tipos,
      ordenes: [],
      tickets: [],
      activity: [],
      branding: { ...SEED_BRANDING },
    };
  }
  return global.__mockStoreV2;
}

/** Solo para tests: vuelve el mock al estado inicial. */
export function __resetMockStore() {
  global.__mockStoreV2 = undefined;
}

export function logActivity(tipo: ActivityLog["tipo"], mensaje: string) {
  const store = getStore();
  store.activity.unshift({ id: uuidv4(), tipo, mensaje, createdAt: new Date().toISOString() });
  if (store.activity.length > 100) store.activity.pop();
}

function porFecha(a: Evento, b: Evento) {
  return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
}

function ticketsDe(eventoId: string): Ticket[] {
  return getStore().tickets.filter((t) => t.eventoId === eventoId);
}

// ─── Eventos ─────────────────────────────────────────────────────────────

export function getEventosPublicados(): Evento[] {
  return getStore()
    .eventos.filter((e) => e.estado === "venta" || e.estado === "pausado")
    .sort(porFecha);
}

export function getEventosAdmin(): Evento[] {
  return getStore().eventos.filter((e) => e.estado !== "finalizado").sort(porFecha);
}

export function getEventoById(eventoId: string): Evento | null {
  return getStore().eventos.find((e) => e.id === eventoId) ?? null;
}

export function getEventoBySlug(slug: string): Evento | null {
  return getStore().eventos.find((e) => e.slug === slug) ?? null;
}

export function getCatalogo(): EventoCatalogo[] {
  const store = getStore();
  return getEventosPublicados().map((ev) =>
    buildCatalogo(
      ev,
      store.tipos.filter((t) => t.eventoId === ev.id),
      ticketsDe(ev.id)
    )
  );
}

export function getEventoCatalogo(eventoId: string): EventoCatalogo | null {
  const ev = getEventoById(eventoId);
  if (!ev) return null;
  return buildCatalogo(
    ev,
    getStore().tipos.filter((t) => t.eventoId === ev.id),
    ticketsDe(ev.id)
  );
}

export function updateEvento(eventoId: string, data: Partial<Evento>): Evento | { error: string } {
  const store = getStore();
  const idx = store.eventos.findIndex((e) => e.id === eventoId);
  if (idx < 0) return { error: "Fiesta no encontrada" };
  const cambios = { ...data };
  delete cambios.estado;
  delete cambios.activo;
  delete cambios.id;
  if (cambios.slug !== undefined) {
    const otros = store.eventos.filter((e) => e.id !== eventoId).map((e) => e.slug);
    if (otros.includes(cambios.slug)) return { error: "Ese link ya lo usa otra fiesta" };
  }
  store.eventos[idx] = { ...store.eventos[idx], ...cambios };
  return store.eventos[idx];
}

// ─── Tipos de entrada ────────────────────────────────────────────────────

export function getTiposByEvento(eventoId: string): TipoEntrada[] {
  return ordenarTipos(getStore().tipos.filter((t) => t.eventoId === eventoId));
}

export function getTiposDisponibles(eventoId: string): TipoEntradaDisponible[] {
  const ev = getEventoById(eventoId);
  if (!ev) return [];
  return evaluarTipos(ev, getTiposByEvento(eventoId), ticketsDe(eventoId));
}

export function getTipoById(tipoId: string): TipoEntrada | null {
  return getStore().tipos.find((t) => t.id === tipoId) ?? null;
}

export function createTipo(eventoId: string, input: TipoEntradaInput): TipoEntrada | { error: string } {
  if (!getEventoById(eventoId)) return { error: "Fiesta no encontrada" };
  const tipo: TipoEntrada = { ...input, id: uuidv4(), eventoId, createdAt: new Date().toISOString() };
  getStore().tipos.push(tipo);
  return tipo;
}

export function updateTipo(tipoId: string, input: Partial<TipoEntradaInput>): TipoEntrada | { error: string } {
  const store = getStore();
  const idx = store.tipos.findIndex((t) => t.id === tipoId);
  if (idx < 0) return { error: "Tipo no encontrado" };
  store.tipos[idx] = { ...store.tipos[idx], ...input };
  return store.tipos[idx];
}

export function deleteTipo(tipoId: string): { ok: true } | { error: string } {
  const store = getStore();
  const usado =
    store.ordenes.some((o) => o.tipoEntradaId === tipoId) ||
    store.tickets.some((t) => t.tipoEntradaId === tipoId);
  if (usado) return { error: "Este tipo ya tiene compras: desactivalo en lugar de borrarlo" };
  store.tipos = store.tipos.filter((t) => t.id !== tipoId);
  return { ok: true };
}

export function reordenarTipos(eventoId: string, ids: string[]): { ok: true } {
  const store = getStore();
  ids.forEach((id, i) => {
    const t = store.tipos.find((x) => x.id === id && x.eventoId === eventoId);
    if (t) t.orden = i;
  });
  return { ok: true };
}

// ─── Órdenes ─────────────────────────────────────────────────────────────

export function createOrdenPendiente(input: {
  eventoId: string;
  tipoEntradaId: string;
  compradorNombre: string;
  compradorEmail: string;
  cantidad: number;
}): { orden: Orden } | { error: string } {
  const store = getStore();
  const evento = getEventoById(input.eventoId);
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

  const disponible = getTiposDisponibles(evento.id).find((t) => t.id === input.tipoEntradaId);
  const problema = validarCompraTipo(disponible, input.cantidad);
  if (problema || !disponible) return { error: problema ?? "Tipo no disponible" };

  const orden: Orden = {
    id: uuidv4(),
    eventoId: evento.id,
    tipoEntradaId: disponible.id,
    tipoNombre: disponible.nombre,
    precioUnitario: disponible.precio,
    paymentId: null,
    paymentMethod: null,
    compradorNombre: input.compradorNombre.trim(),
    compradorEmail: input.compradorEmail.trim().toLowerCase(),
    cantidad: input.cantidad,
    montoTotal: disponible.precio * input.cantidad,
    estado: "pendiente",
    createdAt: new Date().toISOString(),
    emailSentAt: null,
    modoPago: null,
    montoReembolsado: 0,
  };
  store.ordenes.unshift(orden);
  return { orden };
}

export function getOrdenByPaymentId(paymentId: string): Orden | null {
  return getStore().ordenes.find((o) => o.paymentId === paymentId) ?? null;
}

export function setOrdenPaymentId(
  ordenId: string,
  paymentId: string,
  paymentMethod?: PaymentMethod
): { ok: true } | { error: string } {
  const orden = getStore().ordenes.find((o) => o.id === ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  if (orden.estado !== "pendiente") return { error: "Orden no está pendiente" };
  orden.paymentId = paymentId;
  if (paymentMethod) orden.paymentMethod = paymentMethod;
  return { ok: true };
}

export async function approveOrden(
  ordenId: string,
  paymentId?: string,
  paymentMethod?: PaymentMethod,
  modoPago: ModoPago = "simulado"
): Promise<{ orden: Orden; tickets: Ticket[]; nueva: boolean } | { error: string }> {
  const store = getStore();
  const orden = store.ordenes.find((o) => o.id === ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  if (orden.estado === "aprobado") {
    return { orden, tickets: store.tickets.filter((t) => t.ordenId === ordenId), nueva: false };
  }
  if (orden.estado !== "pendiente") return { error: "Orden no está pendiente" };

  const evento = getEventoById(orden.eventoId);
  if (!evento) return { error: "Fiesta no encontrada" };
  const tickets = ticketsDe(evento.id).filter((t) => !t.cancelado);
  if (tickets.length + orden.cantidad > evento.capacidad) return { error: "Capacidad agotada" };

  const tipo = orden.tipoEntradaId ? getTipoById(orden.tipoEntradaId) : null;
  if (tipo?.cupo != null) {
    const vendidasTipo = tickets.filter((t) => t.tipoEntradaId === tipo.id).length;
    if (vendidasTipo + orden.cantidad > tipo.cupo) return { error: `Cupo ${tipo.nombre} agotado` };
  }

  orden.estado = "aprobado";
  orden.paymentId = paymentId ?? `mock_${orden.id.slice(0, 8)}`;
  if (paymentMethod) orden.paymentMethod = paymentMethod;
  orden.modoPago = modoPago;

  const now = new Date().toISOString();
  const nuevos: Ticket[] = Array.from({ length: orden.cantidad }, (_, i) => ({
    id: uuidv4(),
    ordenId: orden.id,
    eventoId: orden.eventoId,
    tipoEntradaId: orden.tipoEntradaId,
    tipoNombre: orden.tipoNombre,
    estilo: tipo?.estilo ?? "general",
    compradorNombre: orden.compradorNombre,
    compradorEmail: orden.compradorEmail,
    numeroEntrada: i + 1,
    totalEntradas: orden.cantidad,
    usado: false,
    cancelado: false,
    usadoAt: null,
    canceladoAt: null,
    motivoCancelacion: null,
    reembolsado: false,
    createdAt: now,
  }));
  store.tickets.unshift(...nuevos);

  logActivity(
    "venta",
    `Venta ${evento.slug}: ${orden.compradorNombre}, ${orden.cantidad} × ${orden.tipoNombre}, $${orden.montoTotal.toLocaleString("es-AR")}`
  );
  return { orden, tickets: nuevos, nueva: true };
}

export function rejectOrden(ordenId: string): { orden: Orden } | { error: string } {
  const orden = getStore().ordenes.find((o) => o.id === ordenId);
  if (!orden) return { error: "Orden no encontrada" };
  if (orden.estado !== "pendiente") return { error: "Orden no está pendiente" };
  orden.estado = "rechazado";
  return { orden };
}

export function getOrden(ordenId: string): Orden | undefined {
  return getStore().ordenes.find((o) => o.id === ordenId);
}

export function getTicketsByOrden(ordenId: string): Ticket[] {
  return getStore()
    .tickets.filter((t) => t.ordenId === ordenId)
    .sort((a, b) => a.numeroEntrada - b.numeroEntrada);
}

export function getTicket(ticketId: string): Ticket | null {
  return getStore().tickets.find((t) => t.id === ticketId) ?? null;
}

/** Reserva el envío del mail (idempotente). Devuelve true si este proceso debe enviarlo. */
export function claimEmailSend(ordenId: string): boolean {
  const orden = getOrden(ordenId);
  if (!orden || orden.emailSentAt) return false;
  orden.emailSentAt = new Date().toISOString();
  return true;
}

export function releaseEmailSend(ordenId: string) {
  const orden = getOrden(ordenId);
  if (orden) orden.emailSentAt = null;
}

// ─── Puerta ──────────────────────────────────────────────────────────────

export function verifyTicket(ticketId: string, eventoId?: string): VerifyResult {
  const ticket = getTicket(ticketId);
  if (!ticket) return { status: "invalido", message: "QR no reconocido" };

  const evento = getEventoById(ticket.eventoId);
  const modo = getOrden(ticket.ordenId)?.modoPago;
  const extra = {
    eventoNombre: evento?.nombre,
    eventoFecha: evento?.fecha,
    prueba: modo === "simulado" || modo === "sandbox",
  };

  if (eventoId && ticket.eventoId !== eventoId) {
    return { status: "otro_evento", ticket, ...extra, message: "Es de otra fiesta" };
  }
  if (ticket.cancelado) {
    return { status: "cancelada", ticket, ...extra, message: mensajeCancelada(ticket) };
  }
  if (ticket.usado) {
    return {
      status: "usada",
      ticket,
      ...extra,
      message: `Ya ingresó${ticket.usadoAt ? ` a las ${horaAr(ticket.usadoAt)} hs` : ""}`,
    };
  }

  ticket.usado = true;
  ticket.usadoAt = new Date().toISOString();
  logActivity(
    "ingreso",
    `Ingreso ${evento?.slug ?? ""}: ${ticket.compradorNombre} · ${ticket.tipoNombre} (${ticket.numeroEntrada}/${ticket.totalEntradas})`
  );
  return { status: "valido", ticket, ...extra, message: "Entrada válida · bienvenido/a" };
}

export function cancelTicket(ticketId: string, motivo?: string): { ticket: Ticket } | { error: string } {
  const ticket = getTicket(ticketId);
  if (!ticket) return { error: "Ticket no encontrado" };
  if (ticket.cancelado) return { error: "Ya está cancelado" };
  ticket.cancelado = true;
  ticket.canceladoAt = new Date().toISOString();
  ticket.motivoCancelacion = motivo ?? null;
  logActivity("baja", `Baja: ${ticket.compradorNombre} (entrada ${ticket.numeroEntrada}/${ticket.totalEntradas})`);
  return { ticket };
}

/** Anula entradas de una compra (a mano, después de hablar con el comprador). */
export function anularTickets(input: {
  ordenId: string;
  ticketIds: string[];
  motivo: string;
  devolverPlata: boolean;
}): { orden: Orden; tickets: Ticket[]; monto: number } | { error: string } {
  const orden = getOrden(input.ordenId);
  if (!orden) return { error: "Compra no encontrada" };
  if (orden.estado !== "aprobado") return { error: "Solo se pueden anular compras con pago aprobado" };
  const motivo = input.motivo.trim();
  if (!motivo) return { error: "Elegí el motivo de la anulación" };

  const tickets = getTicketsByOrden(orden.id);
  const prep = prepararAnulacion(orden, tickets, input.ticketIds);
  if ("error" in prep) return prep;

  const now = new Date().toISOString();
  for (const t of prep.tickets) {
    t.cancelado = true;
    t.canceladoAt = now;
    t.motivoCancelacion = `Anulación: ${motivo}`;
    t.reembolsado = input.devolverPlata;
  }
  const monto = input.devolverPlata ? prep.monto : 0;
  orden.montoReembolsado += monto;
  if (!tickets.some((t) => !t.cancelado) && orden.montoReembolsado > 0) orden.estado = "reembolsado";

  const evento = getEventoById(orden.eventoId);
  logActivity(
    input.devolverPlata ? "reembolso" : "baja",
    textoAnulacion(evento?.slug ?? "", orden, prep.tickets.length, monto, motivo)
  );
  return { orden, tickets: prep.tickets, monto };
}

// ─── Admin ───────────────────────────────────────────────────────────────

export function getOrdenes(eventoId: string): Orden[] {
  return getStore().ordenes.filter((o) => o.eventoId === eventoId);
}

export function getTickets(eventoId: string): Ticket[] {
  return ticketsDe(eventoId);
}

export function getActivity(): ActivityLog[] {
  return [...getStore().activity];
}

export function getAdminStats(eventoId: string): AdminStats {
  const ev = getEventoById(eventoId);
  return computeStats(
    { capacidad: ev?.capacidad ?? 0 },
    getTiposByEvento(eventoId),
    getOrdenes(eventoId),
    ticketsDe(eventoId)
  );
}

function cambiarEstado(
  eventoId: string,
  desde: Evento["estado"][],
  hacia: Evento["estado"],
  error: string
): { evento: Evento } | { error: string } {
  const ev = getEventoById(eventoId);
  if (!ev) return { error: "Fiesta no encontrada" };
  if (!desde.includes(ev.estado)) return { error };
  ev.estado = hacia;
  return { evento: ev };
}

export function resetVentas(eventoId: string): { ok: true } | { error: string } {
  const store = getStore();
  const ev = getEventoById(eventoId);
  if (!ev) return { error: "Fiesta no encontrada" };
  if (ev.estado !== "borrador") return { error: "Solo se puede reiniciar ventas en borrador (modo prueba)" };
  store.ordenes = store.ordenes.filter((o) => o.eventoId !== eventoId);
  store.tickets = store.tickets.filter((t) => t.eventoId !== eventoId);
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

export function cerrarEvento(eventoId: string): { evento: Evento } | { error: string } {
  const store = getStore();
  const ev = getEventoById(eventoId);
  if (!ev) return { error: "Fiesta no encontrada" };
  if (ev.estado !== "venta" && ev.estado !== "pausado")
    return { error: "Solo se puede cerrar una fiesta en venta o pausada" };
  for (const o of store.ordenes) {
    if (o.eventoId === eventoId && o.estado === "pendiente") o.estado = "rechazado";
  }
  ev.estado = "finalizado";
  ev.activo = false;
  return { evento: ev };
}

export function getEventosFinalizados(): Evento[] {
  return getStore()
    .eventos.filter((e) => e.estado === "finalizado")
    .sort((a, b) => porFecha(b, a));
}

export function getOrdenesByEvento(eventoId: string): Orden[] {
  return getOrdenes(eventoId);
}

export function getTicketsByEvento(eventoId: string): Ticket[] {
  return ticketsDe(eventoId);
}

export function getHistorialItems(): HistorialItem[] {
  return getEventosFinalizados().map((ev) => ({ evento: ev, stats: getAdminStats(ev.id) }));
}

export function crearNuevoEvento(input: NuevoEventoInput): { evento: Evento } | { error: string } {
  const store = getStore();
  if (!input.nombre.trim()) return { error: "El nombre es obligatorio" };
  if (!input.fecha) return { error: "La fecha es obligatoria" };
  if (input.precio <= 0) return { error: "El precio debe ser mayor a 0" };
  if (input.capacidad < 1) return { error: "La capacidad debe ser al menos 1" };

  const anterior = [...store.eventos].reverse()[0] ?? null;
  const copiar = input.copiarBranding && anterior;
  const b = store.branding;

  const evento: Evento = {
    id: `evento-${uuidv4().slice(0, 8)}`,
    slug: uniqueSlug(input.nombre, store.eventos.map((e) => e.slug)),
    nombre: input.nombre.trim(),
    subtitulo: copiar ? anterior.subtitulo : "",
    dj: "",
    fecha: input.fecha,
    precio: input.precio,
    capacidad: input.capacidad,
    activo: true,
    estado: "borrador",
    logoUrl: copiar ? anterior.logoUrl : b.logoUrl,
    flyerUrl: "",
    colorPrimario: copiar ? anterior.colorPrimario : b.colorPrimario,
    colorSecundario: copiar ? anterior.colorSecundario : "#0b0b10",
    descripcion: "",
    lugar: copiar ? anterior.lugar : "",
    mapsUrl: copiar ? anterior.mapsUrl : "",
    contactoWhatsapp: copiar ? anterior.contactoWhatsapp : b.contactoWhatsapp,
    contactoEmail: copiar ? anterior.contactoEmail : b.contactoEmail,
    contactoInstagram: copiar ? anterior.contactoInstagram : b.contactoInstagram,
    textoFooter: copiar ? anterior.textoFooter : b.textoFooter,
    organizadorNombre: copiar ? anterior.organizadorNombre : b.nombre,
    mensajePostergado: "",
    proximamente: false,
    ventaAbre: null,
  };
  store.eventos.push(evento);
  store.tipos.push({
    id: uuidv4(),
    eventoId: evento.id,
    nombre: "General",
    descripcion: "Acceso a la fiesta toda la noche.",
    beneficios: [],
    precio: input.precio,
    cupo: null,
    ventaDesde: null,
    ventaHasta: null,
    estilo: "general",
    colorAcento: "",
    activo: true,
    orden: 0,
    proximamente: false,
    mostrarPrecioPrevio: false,
    createdAt: new Date().toISOString(),
  });
  return { evento };
}

// ─── Marca ───────────────────────────────────────────────────────────────

export function getBranding(): Branding {
  return { ...getStore().branding };
}

export function updateBranding(data: Partial<Branding>): Branding {
  const store = getStore();
  store.branding = { ...store.branding, ...data };
  return { ...store.branding };
}
