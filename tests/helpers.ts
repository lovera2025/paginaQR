import type { Evento, Orden, Ticket, TipoEntrada } from "@/types";

export const AHORA = new Date("2026-11-20T12:00:00-03:00");

export function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: "ev-1",
    slug: "fiesta",
    nombre: "Fiesta de prueba",
    subtitulo: "",
    dj: "",
    fecha: "2026-12-04T22:00:00-03:00",
    precio: 18000,
    capacidad: 100,
    activo: true,
    estado: "venta",
    logoUrl: "",
    flyerUrl: "",
    colorPrimario: "#d4a853",
    colorSecundario: "#050508",
    descripcion: "",
    lugar: "",
    mapsUrl: "",
    contactoWhatsapp: "",
    contactoEmail: "",
    contactoInstagram: "",
    textoFooter: "",
    organizadorNombre: "Junior Eventos",
    mensajePostergado: "",
    proximamente: false,
    ventaAbre: null,
    ...over,
  };
}

export function tipo(over: Partial<TipoEntrada> = {}): TipoEntrada {
  return {
    id: "t-gen",
    eventoId: "ev-1",
    nombre: "General",
    descripcion: "",
    beneficios: [],
    precio: 18000,
    cupo: null,
    ventaDesde: null,
    ventaHasta: null,
    estilo: "general",
    colorAcento: "",
    activo: true,
    orden: 0,
    proximamente: false,
    mostrarPrecioPrevio: false,
    createdAt: "2026-11-01T00:00:00Z",
    ...over,
  };
}

let n = 0;
export function ticket(over: Partial<Ticket> = {}): Ticket {
  n += 1;
  return {
    id: `tk-${n}`,
    ordenId: "o-1",
    eventoId: "ev-1",
    tipoEntradaId: "t-gen",
    tipoNombre: "General",
    estilo: "general",
    compradorNombre: "Ana",
    compradorEmail: "ana@test.com",
    numeroEntrada: 1,
    totalEntradas: 1,
    usado: false,
    cancelado: false,
    usadoAt: null,
    canceladoAt: null,
    motivoCancelacion: null,
    reembolsado: false,
    createdAt: "2026-11-10T00:00:00Z",
    ...over,
  };
}

export function orden(over: Partial<Orden> = {}): Orden {
  return {
    id: "o-1",
    eventoId: "ev-1",
    tipoEntradaId: "t-gen",
    tipoNombre: "General",
    precioUnitario: 18000,
    paymentId: null,
    paymentMethod: null,
    compradorNombre: "Ana",
    compradorEmail: "ana@test.com",
    cantidad: 1,
    montoTotal: 18000,
    estado: "aprobado",
    createdAt: "2026-11-10T00:00:00Z",
    emailSentAt: null,
    modoPago: "produccion",
    montoReembolsado: 0,
    ...over,
  };
}
