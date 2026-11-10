import type { Branding, Evento, TipoEntrada } from "@/types";

/** Datos de las 9 recepciones (flyers reales). Precios y horarios son de ejemplo: se editan desde el admin. */
interface RecepcionSeed {
  slug: string;
  nombre: string;
  dia: string; // YYYY-MM-DD (hora Argentina)
  lugar: string;
  dj: string;
  fondo: string;
  acento: string;
}

const RECEPCIONES: RecepcionSeed[] = [
  { slug: "pinaroli", nombre: "Escuela Técnica Arq. Francisco Pinaroli", dia: "2026-12-04", lugar: "Predio Costa Surubí", dj: "Lautaro Gorostegui", fondo: "#0f1f0c", acento: "#d4a853" },
  { slug: "la-rotonda", nombre: "Escuela Parroquial \"La Rotonda\"", dia: "2026-12-06", lugar: "Predio Costa Surubí", dj: "Tomy Alegre", fondo: "#0e1a2b", acento: "#d4a853" },
  { slug: "guemes-de-tejada", nombre: "Colegio Secundario \"Magdalena Güemes de Tejada\"", dia: "2026-12-07", lugar: "Predio Costa Surubí", dj: "Tomy Alegre", fondo: "#0f1f0c", acento: "#e0953c" },
  { slug: "gregoria-morales", nombre: "Colegio Secundario \"Gregoria Morales\"", dia: "2026-12-12", lugar: "Predio Costa Surubí", dj: "Facu Portalea", fondo: "#2a0f0b", acento: "#d4a853" },
  { slug: "buena-vista", nombre: "Colegio Secundario de Buena Vista", dia: "2026-12-12", lugar: "Complejo La Conquista", dj: "Augusto Aguirre", fondo: "#0e1a2b", acento: "#c0392b" },
  { slug: "torrent", nombre: "Colegio Secundario \"Dr. Juan Eusebio Torrent\"", dia: "2026-12-18", lugar: "Predio Costa Surubí", dj: "Lautaro Pasetto", fondo: "#0a0a0a", acento: "#c0392b" },
  { slug: "sagrado-corazon", nombre: "Colegio Secundario Sagrado Corazón de Jesús", dia: "2026-12-19", lugar: "Predio Costa Surubí", dj: "Facu Portalea", fondo: "#2a0f0b", acento: "#d4a853" },
  { slug: "puerto-viejo", nombre: "Colegio Secundario Puerto Viejo", dia: "2026-12-19", lugar: "Predio Negri", dj: "Cu3rvo", fondo: "#0b1a12", acento: "#d4a853" },
  { slug: "mariano-loza", nombre: "Escuela Normal Mariano I. Loza", dia: "2026-12-26", lugar: "Predio Costa Surubí", dj: "Facu Portalea", fondo: "#0e1a2b", acento: "#d4a853" },
];

/** 22:00 hora Argentina (UTC-3). */
function fechaAr(dia: string, hora = "22:00"): string {
  return new Date(`${dia}T${hora}:00-03:00`).toISOString();
}

function restarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

export const POLITICA_ANULACION_DEFAULT =
  "¿Te arrepentiste? Escribinos por WhatsApp dentro de las 4 horas de la compra y te devolvemos el dinero. Pasado ese plazo no hay devolución.";

export const SEED_BRANDING: Branding = {
  nombre: "Junior Eventos",
  logoUrl: "",
  tagline: "Recepciones de egresados · Promo 2026",
  contactoWhatsapp: "",
  contactoInstagram: "junior_eventos_ok",
  contactoEmail: "",
  textoFooter: "Entradas personales con QR. Cada QR vale una sola vez.",
  colorPrimario: "#d4a853",
  colorSecundario: "#050508",
  politicaAnulacion: POLITICA_ANULACION_DEFAULT,
};

export function buildSeed(): { eventos: Evento[]; tipos: TipoEntrada[] } {
  const createdAt = new Date().toISOString();
  const eventos: Evento[] = [];
  const tipos: TipoEntrada[] = [];

  for (const r of RECEPCIONES) {
    const id = `rec-${r.slug}`;
    eventos.push({
      id,
      slug: r.slug,
      nombre: r.nombre,
      subtitulo: "Recepción baile · Egresados Promo 2026",
      dj: r.dj,
      fecha: fechaAr(r.dia),
      precio: 18000,
      capacidad: 400,
      activo: true,
      // Una queda en borrador para probar la vista previa desde el admin.
      estado: r.slug === "mariano-loza" ? "borrador" : "venta",
      logoUrl: "",
      flyerUrl: `/flyers/${r.slug}.png`,
      colorPrimario: r.acento,
      colorSecundario: r.fondo,
      descripcion: `Recepción de egresados Promo 2026. Apertura 22:00 hs con DJ ${r.dj} toda la noche. Entrada personal con QR, válida una sola vez.`,
      lugar: r.lugar,
      mapsUrl: "",
      contactoWhatsapp: "",
      contactoEmail: "",
      contactoInstagram: "junior_eventos_ok",
      textoFooter: SEED_BRANDING.textoFooter,
      organizadorNombre: SEED_BRANDING.nombre,
      mensajePostergado: "",
      mensajeProximamente: "",
      proximamente: false,
      ventaAbre: null,
    });

    // Anticipada a la venta; General abre sola cuando cierra la anticipada; VIP "fecha a confirmar".
    const cierreAnticipada = fechaAr(restarDias(r.dia, 7), "23:59");

    tipos.push(
      {
        id: `${id}-anticipada`,
        eventoId: id,
        nombre: "Anticipada",
        descripcion: "Mismo acceso que la General, a precio promo.",
        beneficios: [],
        precio: 15000,
        cupo: 150,
        ventaDesde: null,
        ventaHasta: cierreAnticipada,
        estilo: "anticipada",
        colorAcento: "",
        activo: true,
        orden: 0,
        proximamente: false,
        mostrarPrecioPrevio: false,
        createdAt,
      },
      {
        id: `${id}-general`,
        eventoId: id,
        nombre: "General",
        descripcion: "Acceso a la fiesta toda la noche.",
        beneficios: [],
        precio: 18000,
        cupo: null,
        ventaDesde: cierreAnticipada,
        ventaHasta: null,
        estilo: "general",
        colorAcento: "",
        activo: true,
        orden: 1,
        proximamente: true,
        mostrarPrecioPrevio: false,
        createdAt,
      },
      {
        id: `${id}-vip`,
        eventoId: id,
        nombre: "VIP",
        descripcion: "Sector VIP con barra exclusiva.",
        beneficios: ["Sector VIP", "Barra exclusiva", "Ingreso preferencial"],
        precio: 35000,
        cupo: 40,
        ventaDesde: null,
        ventaHasta: null,
        estilo: "vip",
        colorAcento: "",
        activo: true,
        orden: 2,
        proximamente: true,
        mostrarPrecioPrevio: false,
        createdAt,
      }
    );
  }

  return { eventos, tipos };
}
