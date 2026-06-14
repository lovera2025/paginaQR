import type { Evento } from "@/types";

export const SEED_EVENTO: Evento = {
  id: "evento-demo",
  nombre: "Fiesta de Promo — Buzo Chomba Bandera",
  fecha: "2026-06-20T23:00:00.000Z",
  precio: 15000,
  capacidad: 300,
  activo: true,
  estado: "borrador",
  logoUrl: "/flyer.jpeg",
  flyerUrl: "/flyer.jpeg",
  colorPrimario: "#FFCC00",
  colorSecundario: "#1a1a1a",
  descripcion:
    "Fiesta de promo con desfile, presentación y joda. Incluye buzo, chomba y bandera. ¡No te quedes afuera!",
  lugar: "A confirmar",
  mapsUrl: "",
  contactoWhatsapp: "",
  contactoEmail: "",
  contactoInstagram: "",
  textoFooter:
    "Consultas por WhatsApp o redes. Política de reembolsos: contactá al organizador.",
  organizadorNombre: "Promo 2026",
};
