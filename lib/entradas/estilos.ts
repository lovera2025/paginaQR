import type { EntradaEstilo } from "@/types";

/** Colores de marca compartidos (web, PDF, mail, scanner). */
export const BRAND = {
  negro: "#050508",
  dorado: "#d4a853",
  doradoClaro: "#f0d389",
  doradoOscuro: "#b8862e",
  naranja: "#e0953c",
  tinta: "#140f02",
};

export interface EstiloEntradaVisual {
  estilo: EntradaEstilo;
  /** Texto del badge: "VIP", "ANTICIPADA", "GENERAL" o el nombre del tipo. */
  etiqueta: string;
  /** Color principal: borde, badge, marco del QR. */
  acento: string;
  /** Texto sobre el badge. */
  sobreAcento: string;
  /** Fondo de la tarjeta. */
  fondo: string;
  /** Segundo color del fondo (degradé tipo foil en VIP). */
  fondoBrillo: string;
  /** Color de títulos sobre el fondo. */
  titulo: string;
  /** Cinta diagonal (anticipada). */
  cinta: boolean;
  /** Marco doble dorado en el QR (VIP). */
  marcoDoble: boolean;
}

function esHex(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/** Oscurece un color hex mezclándolo con negro (0..1). */
export function oscurecer(hex: string, cantidad: number): string {
  if (!esHex(hex)) return BRAND.negro;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - cantidad));
  const g = Math.round(((n >> 8) & 255) * (1 - cantidad));
  const b = Math.round((n & 255) * (1 - cantidad));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Luminancia aproximada 0..1 para decidir texto claro u oscuro. */
export function luminancia(hex: string): number {
  if (!esHex(hex)) return 0;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function getEstiloEntrada(input: {
  estilo: EntradaEstilo;
  nombre?: string;
  /** Acento de la fiesta (colorPrimario). */
  colorEvento?: string;
  /** Fondo de la fiesta (colorSecundario). */
  fondoEvento?: string;
  colorAcento?: string;
}): EstiloEntradaVisual {
  const acentoEvento = esHex(input.colorEvento ?? "") ? input.colorEvento! : BRAND.dorado;
  const fondoBase = esHex(input.fondoEvento ?? "") ? input.fondoEvento! : "#0b0b10";
  // Si el fondo de la fiesta es claro, lo oscurecemos para que el ticket siga siendo legible.
  const fondo = luminancia(fondoBase) > 0.35 ? oscurecer(fondoBase, 0.8) : fondoBase;

  switch (input.estilo) {
    case "vip":
      return {
        estilo: "vip",
        etiqueta: "VIP",
        acento: BRAND.dorado,
        sobreAcento: BRAND.tinta,
        fondo: "#120e04",
        fondoBrillo: "#3a2b0c",
        titulo: BRAND.doradoClaro,
        cinta: false,
        marcoDoble: true,
      };
    case "anticipada":
      return {
        estilo: "anticipada",
        etiqueta: "ANTICIPADA",
        acento: BRAND.naranja,
        sobreAcento: BRAND.tinta,
        fondo,
        fondoBrillo: fondo,
        titulo: "#ffffff",
        cinta: true,
        marcoDoble: false,
      };
    case "custom": {
      const acento = esHex(input.colorAcento ?? "") ? input.colorAcento! : acentoEvento;
      return {
        estilo: "custom",
        etiqueta: (input.nombre || "ENTRADA").toUpperCase().slice(0, 14),
        acento,
        sobreAcento: luminancia(acento) > 0.55 ? BRAND.tinta : "#ffffff",
        fondo,
        fondoBrillo: fondo,
        titulo: "#ffffff",
        cinta: false,
        marcoDoble: false,
      };
    }
    case "general":
    default:
      return {
        estilo: "general",
        etiqueta: "GENERAL",
        acento: acentoEvento,
        sobreAcento: luminancia(acentoEvento) > 0.55 ? BRAND.tinta : "#ffffff",
        fondo,
        fondoBrillo: fondo,
        titulo: "#ffffff",
        cinta: false,
        marcoDoble: false,
      };
  }
}

export const ESTILO_LABELS: Record<EntradaEstilo, string> = {
  anticipada: "Anticipada (cinta naranja)",
  general: "General (color de la fiesta)",
  vip: "VIP (negro + dorado)",
  custom: "Otro color",
};
