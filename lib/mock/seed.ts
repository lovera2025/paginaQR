import type { Evento } from "@/types";

export const SEED_EVENTO: Evento = {
  id: "evento-demo",
  nombre: "Noche Electrónica 2026",
  fecha: "2026-08-15T22:00:00.000Z",
  precio: 15000,
  capacidad: 200,
  activo: true,
  logoUrl: "",
  flyerUrl:
    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80",
  colorPrimario: "#ff006e",
  colorSecundario: "#8338ec",
  descripcion:
    "Una noche inolvidable con los mejores DJs. Música electrónica, luces y una experiencia única. No te quedes afuera.",
  lugar: "Club Aurora — Av. Corrientes 1234, CABA",
  mapsUrl: "https://maps.google.com",
  contactoWhatsapp: "5491112345678",
  contactoEmail: "info@nocheelectronica.com",
  contactoInstagram: "@nocheelectronica",
  textoFooter:
    "Consultas por WhatsApp o email. Política de reembolsos: contactá al organizador hasta 48hs antes del evento.",
  organizadorNombre: "Aurora Producciones",
};
