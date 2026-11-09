import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { generateQrBuffer } from "@/lib/qr/generate";
import { BRAND, getEstiloEntrada } from "@/lib/entradas/estilos";
import { formatFecha } from "@/lib/utils";
import type { Branding, Evento, Orden, Ticket } from "@/types";

// A6 vertical (105 × 148 mm).
const W = 297.64;
const H = 419.53;
const M = 10; // margen del marco
const HEADER_H = 100;

function hex(color: string) {
  const n = parseInt(/^#[0-9a-fA-F]{6}$/.test(color) ? color.slice(1) : "000000", 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Las fuentes estándar solo soportan WinAnsi: limpiamos lo que no se pueda dibujar. */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function safe(text: string): string {
  return Array.from(text.normalize("NFC"))
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) return ch;
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return base && base.codePointAt(0)! <= 0xff ? base : "";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

async function cargarImagen(url: string, origin: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    if (url.startsWith("/")) {
      // Primero desde /public (local); si no está en el bundle, por HTTP.
      try {
        return new Uint8Array(await readFile(path.join(process.cwd(), "public", url)));
      } catch {
        const res = await fetch(`${origin}${url}`);
        return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
      }
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url);
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    }
  } catch {
    return null;
  }
  return null;
}

async function embedImagen(doc: PDFDocument, bytes: Uint8Array | null): Promise<PDFImage | null> {
  if (!bytes || bytes.length < 4) return null;
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
  return null; // WebP u otros: se usa cabecera de color
}

function badge(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  right: number,
  y: number,
  fondo: string,
  color: string
) {
  const t = safe(text);
  const w = font.widthOfTextAtSize(t, size) + 14;
  const h = size + 9;
  page.drawRectangle({ x: right - w, y, width: w, height: h, color: hex(fondo) });
  page.drawText(t, { x: right - w + 7, y: y + 5, size, font, color: hex(color) });
  return w;
}

function dibujarCinta(page: PDFPage, texto: string, font: PDFFont, acento: string, sobre: string) {
  // Cinta diagonal en la esquina superior derecha.
  const w = 170;
  const h = 18;
  const cx = W - M - 34;
  const cy = H - M - 34;
  const ang = -45;
  const rad = (ang * Math.PI) / 180;
  const ox = cx - ((w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad));
  const oy = cy - ((w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad));
  page.drawRectangle({ x: ox, y: oy, width: w, height: h, color: hex(acento), rotate: degrees(ang) });
  const size = 8.5;
  const tw = font.widthOfTextAtSize(texto, size);
  const tx = cx - ((tw / 2) * Math.cos(rad) - (size / 2.8) * Math.sin(rad));
  const ty = cy - ((tw / 2) * Math.sin(rad) + (size / 2.8) * Math.cos(rad));
  page.drawText(texto, { x: tx, y: ty, size, font, color: hex(sobre), rotate: degrees(ang) });
}

/** Arma un PDF con una página A6 por entrada (diseño según el tipo). */
export async function buildTicketPdf(input: {
  evento: Evento;
  orden: Orden;
  tickets: Ticket[];
  branding: Branding;
  origin: string;
}): Promise<Uint8Array> {
  const { evento, orden, tickets, branding, origin } = input;
  const doc = await PDFDocument.create();
  doc.setTitle(safe(`Entradas — ${evento.nombre}`));
  doc.setAuthor(safe(branding.nombre || "Junior Eventos"));
  doc.setSubject(safe(`${orden.cantidad} × ${orden.tipoNombre}`));

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const flyer = await embedImagen(doc, await cargarImagen(evento.flyerUrl, origin));
  const marca = safe((evento.organizadorNombre || branding.nombre || "Junior Eventos").toUpperCase());
  // Logo oficial (versión clara para el fondo oscuro de la entrada). Si no carga, queda el nombre en texto.
  const esJunior = /junior\s*eventos/i.test(marca);
  const logo = esJunior ? await embedImagen(doc, await cargarImagen("/marca/logo-claro.png", origin)) : null;

  for (const ticket of tickets) {
    const est = getEstiloEntrada({
      estilo: ticket.estilo,
      nombre: ticket.tipoNombre,
      colorEvento: evento.colorPrimario,
      fondoEvento: evento.colorSecundario,
    });
    const etiqueta = est.estilo === "custom" ? ticket.tipoNombre.toUpperCase() : est.etiqueta;
    const page = doc.addPage([W, H]);
    const blanco = rgb(1, 1, 1);

    // Fondo
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: hex(BRAND.negro) });
    page.drawRectangle({ x: M, y: M, width: W - 2 * M, height: H - 2 * M, color: hex(est.fondo) });
    if (est.estilo === "vip") {
      // Brillo diagonal tipo foil
      for (let i = 0; i < 6; i++) {
        page.drawRectangle({
          x: W * 0.15 + i * 14,
          y: -40,
          width: 10,
          height: H * 1.4,
          color: hex(est.fondoBrillo),
          opacity: 0.22 - i * 0.03,
          rotate: degrees(-28),
        });
      }
    }

    // Cabecera con flyer (recortada al marco)
    const headerY = H - M - HEADER_H;
    page.pushOperators(pushGraphicsState(), rectangle(M, headerY, W - 2 * M, HEADER_H), clip(), endPath());
    if (flyer) {
      const iw = W - 2 * M;
      const ih = (flyer.height / flyer.width) * iw;
      page.drawImage(flyer, { x: M, y: H - M - ih * 0.86, width: iw, height: ih, opacity: est.estilo === "vip" ? 0.75 : 1 });
    } else {
      page.drawRectangle({ x: M, y: headerY, width: W - 2 * M, height: HEADER_H, color: hex(evento.colorPrimario || BRAND.dorado), opacity: 0.35 });
    }
    for (let i = 0; i < 12; i++) {
      page.drawRectangle({
        x: M,
        y: headerY + i * 6,
        width: W - 2 * M,
        height: 6,
        color: hex(est.fondo),
        opacity: Math.max(0, 0.95 - i * 0.08),
      });
    }
    if (est.cinta) dibujarCinta(page, safe(etiqueta), bold, est.acento, est.sobreAcento);
    page.pushOperators(popGraphicsState());

    if (logo) {
      const lh = 15;
      page.drawImage(logo, { x: M + 12, y: headerY + 8, width: (logo.width / logo.height) * lh, height: lh });
    } else {
      page.drawText(marca, { x: M + 14, y: headerY + 12, size: 8.5, font: bold, color: hex(est.estilo === "vip" ? BRAND.doradoClaro : est.acento) });
    }
    if (!est.cinta) badge(page, etiqueta, bold, 8.5, W - M - 12, headerY + 9, est.acento, est.sobreAcento);

    // Línea de corte
    page.drawLine({
      start: { x: M + 6, y: headerY },
      end: { x: W - M - 6, y: headerY },
      thickness: 1,
      color: blanco,
      opacity: 0.25,
      dashArray: [4, 3],
    });
    page.drawCircle({ x: M, y: headerY, size: 7, color: hex(BRAND.negro) });
    page.drawCircle({ x: W - M, y: headerY, size: 7, color: hex(BRAND.negro) });

    // Datos de la fiesta
    let y = headerY - 20;
    const x0 = M + 14;
    const maxW = W - 2 * M - 28;
    page.drawText(fit((evento.subtitulo || "Recepción · Promo 2026").toUpperCase(), regular, 6.8, maxW), {
      x: x0, y, size: 6.8, font: regular, color: blanco, opacity: 0.6,
    });
    y -= 15;
    for (const line of wrap(evento.nombre, bold, 12.5, maxW, 2)) {
      page.drawText(line, { x: x0, y, size: 12.5, font: bold, color: hex(est.titulo) });
      y -= 14;
    }
    page.drawText(fit(`${formatFecha(evento.fecha)} · ${evento.lugar || "Lugar a confirmar"}`, regular, 8, maxW), {
      x: x0, y: y - 1, size: 8, font: regular, color: blanco, opacity: 0.75,
    });
    y -= 16;

    // A nombre de
    const boxH = 30;
    page.drawRectangle({
      x: x0, y: y - boxH, width: maxW, height: boxH,
      color: hex(est.acento), opacity: 0.14, borderColor: hex(est.acento), borderOpacity: 0.5, borderWidth: 0.8,
    });
    page.drawText("A NOMBRE DE", { x: x0 + 8, y: y - 11, size: 6, font: regular, color: blanco, opacity: 0.6 });
    page.drawText(fit(ticket.compradorNombre, bold, 10, maxW - 90), { x: x0 + 8, y: y - 23, size: 10, font: bold, color: blanco });
    badge(page, est.estilo === "vip" ? "SECTOR VIP" : etiqueta, bold, 7, x0 + maxW - 7, y - 21, est.acento, est.sobreAcento);
    y -= boxH + 8;

    // QR: usa todo el espacio libre entre el recuadro del nombre y el pie.
    const pieY = M + 34;
    const libreArriba = y - 12;
    const libreAbajo = pieY + 16 + 11;
    const qrSize = Math.max(96, Math.min(150, libreArriba - libreAbajo));
    const qr = await doc.embedPng(await generateQrBuffer(ticket.id));
    const qx = (W - qrSize) / 2;
    const qy = libreAbajo + Math.max(0, (libreArriba - libreAbajo - qrSize) / 2);
    if (est.marcoDoble) {
      page.drawRectangle({ x: qx - 11, y: qy - 11, width: qrSize + 22, height: qrSize + 22, color: hex(BRAND.doradoClaro) });
      page.drawRectangle({ x: qx - 9, y: qy - 9, width: qrSize + 18, height: qrSize + 18, color: hex(BRAND.tinta) });
    }
    page.drawRectangle({ x: qx - 7, y: qy - 7, width: qrSize + 14, height: qrSize + 14, color: hex(est.acento) });
    page.drawRectangle({ x: qx - 4, y: qy - 4, width: qrSize + 8, height: qrSize + 8, color: blanco });
    page.drawImage(qr, { x: qx, y: qy, width: qrSize, height: qrSize });

    if (ticket.usado || ticket.cancelado) {
      const sello = ticket.cancelado ? "ANULADA" : "YA INGRESÓ";
      const color = ticket.cancelado ? "#dc2626" : "#d97706";
      page.drawRectangle({ x: qx - 10, y: qy + qrSize / 2 - 14, width: qrSize + 20, height: 28, color: hex(color), opacity: 0.92, rotate: degrees(0) });
      const tw = bold.widthOfTextAtSize(safe(sello), 14);
      page.drawText(safe(sello), { x: (W - tw) / 2, y: qy + qrSize / 2 - 5, size: 14, font: bold, color: blanco });
    }

    // Pie
    page.drawText(safe(`Entrada ${ticket.numeroEntrada} de ${ticket.totalEntradas}`), {
      x: x0, y: pieY, size: 9, font: bold, color: hex(est.estilo === "vip" ? BRAND.doradoClaro : "#ffffff"),
    });
    const id = `ID ${ticket.id.slice(0, 4).toUpperCase()}-${ticket.id.slice(4, 8).toUpperCase()}`;
    page.drawText(id, {
      x: x0 + maxW - regular.widthOfTextAtSize(id, 7.5), y: pieY + 1, size: 7.5, font: regular, color: blanco, opacity: 0.55,
    });
    const aviso = "Entrada personal · válida una sola vez · mostrala en la puerta";
    const aw = regular.widthOfTextAtSize(safe(aviso), 6.5);
    page.drawText(safe(aviso), { x: (W - aw) / 2, y: M + 14, size: 6.5, font: regular, color: blanco, opacity: 0.55 });

    // Marco
    page.drawRectangle({
      x: M, y: M, width: W - 2 * M, height: H - 2 * M,
      borderColor: hex(est.acento), borderWidth: est.estilo === "vip" ? 2.2 : 1.2, borderOpacity: est.estilo === "vip" ? 1 : 0.6,
    });
  }

  return doc.save();
}

export function nombreArchivoPdf(evento: Evento, sufijo: string): string {
  const base = (evento.slug || "entrada").replace(/[^a-z0-9-]/gi, "");
  return `entradas-${base}-${sufijo}.pdf`;
}
