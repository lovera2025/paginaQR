import { getAppUrl } from "@/lib/config";
import { BRAND, getEstiloEntrada } from "@/lib/entradas/estilos";
import { formatFecha } from "@/lib/utils";
import type { Branding, Evento, Orden, Ticket } from "@/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatFechaAsunto(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function buildConfirmationSubject(evento: Evento, orden: Orden): string {
  const n = orden.cantidad;
  return `Tus ${n > 1 ? `${n} entradas` : "entrada"} ${orden.tipoNombre} — ${evento.nombre} · ${formatFechaAsunto(evento.fecha)}`;
}

function boton(href: string, texto: string, primario: boolean): string {
  const estilo = primario
    ? `background:${BRAND.dorado};color:${BRAND.tinta};`
    : `background:transparent;color:#ffffff;border:1px solid #555;`;
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 4px;padding:14px 22px;border-radius:999px;font-weight:700;font-size:15px;text-decoration:none;${estilo}">${texto}</a>`;
}

export function buildConfirmationHtml(input: {
  orden: Orden;
  tickets: Ticket[];
  evento: Evento;
  branding: Branding;
  flyerCid: string | null;
  qrCids: string[];
}): string {
  const { orden, tickets, evento, branding, flyerCid, qrCids } = input;
  const appUrl = getAppUrl();
  const organizador = evento.organizadorNombre || branding.nombre || "Junior Eventos";
  const verUrl = `${appUrl}/compra/exito?orden=${orden.id}`;
  const pdfUrl = `${appUrl}/api/ordenes/${orden.id}/pdf`;
  const lugar = escapeHtml(evento.lugar || "A confirmar");
  const mapsLink = evento.mapsUrl?.trim()
    ? ` · <a href="${escapeHtml(evento.mapsUrl)}" style="color:${BRAND.dorado};">Cómo llegar</a>`
    : "";

  const flyerBlock = flyerCid
    ? `<img src="cid:${flyerCid}" alt="${escapeHtml(evento.nombre)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;" />`
    : "";

  const ticketCards = tickets
    .map((ticket, index) => {
      const cid = qrCids[index];
      const est = getEstiloEntrada({
        estilo: ticket.estilo,
        nombre: ticket.tipoNombre,
        colorEvento: evento.colorPrimario,
        fondoEvento: evento.colorSecundario,
      });
      const label = ticket.totalEntradas > 1 ? `Entrada ${ticket.numeroEntrada} de ${ticket.totalEntradas}` : "Tu entrada";
      const marco = est.marcoDoble ? `border:4px solid ${est.acento};box-shadow:0 0 0 3px ${BRAND.tinta},0 0 0 5px ${BRAND.doradoClaro};` : `border:3px solid ${est.acento};`;
      return `
        <div style="margin:0 0 18px;padding:18px;background:${est.fondo};border:2px solid ${est.acento};border-radius:18px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.12em;color:#bbb;">${label.toUpperCase()}</p>
          <p style="margin:0 0 14px;"><span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${est.acento};color:${est.sobreAcento};font-weight:800;font-size:13px;letter-spacing:0.14em;">${escapeHtml(est.estilo === "custom" ? ticket.tipoNombre.toUpperCase() : est.etiqueta)}</span></p>
          <div style="display:inline-block;padding:10px;background:#ffffff;border-radius:14px;${marco}">
            <img src="cid:${cid}" alt="QR entrada ${ticket.numeroEntrada}" width="240" height="240" style="display:block;width:240px;height:240px;" />
          </div>
          <p style="margin:12px 0 0;font-size:14px;color:#fff;font-weight:700;">${escapeHtml(ticket.compradorNombre)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#888;font-family:monospace;letter-spacing:0.1em;">ID ${ticket.id.slice(0, 8).toUpperCase()}</p>
        </div>`;
    })
    .join("");

  const whatsapp = evento.contactoWhatsapp?.trim() || branding.contactoWhatsapp?.trim();
  const whatsappBlock = whatsapp
    ? `<p style="margin:14px 0 0;font-size:14px;color:#aaa;">Dudas: <a href="https://wa.me/${whatsapp.replace(/\D/g, "")}" style="color:${BRAND.dorado};">WhatsApp</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b10;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${BRAND.negro};border:1px solid #2a2418;border-radius:18px;overflow:hidden;color:#fff;">
          <tr><td>${flyerBlock}</td></tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <p style="margin:0 0 10px;font-size:13px;letter-spacing:0.2em;color:${BRAND.dorado};font-weight:700;">${escapeHtml(organizador.toUpperCase())}</p>
              <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2;color:#fff;">${escapeHtml(evento.nombre)}</h1>
              <p style="margin:0;font-size:15px;color:#ddd;">${escapeHtml(formatFecha(evento.fecha))}</p>
              <p style="margin:6px 0 0;font-size:14px;color:#bbb;">${lugar}${mapsLink}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px;">
              <p style="margin:0 0 6px;font-size:16px;">¡Hola <strong>${escapeHtml(orden.compradorNombre)}</strong>! Tu pago está confirmado.</p>
              <p style="margin:0;font-size:15px;color:#ddd;">Tenés <strong>${tickets.length} entrada${tickets.length !== 1 ? "s" : ""} ${escapeHtml(orden.tipoNombre)}</strong>. Cada QR vale para un solo ingreso.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:14px 20px 18px;">
              ${boton(pdfUrl, "Descargar PDF", true)}
              ${boton(verUrl, "Ver mis entradas", false)}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 18px;">
              ${ticketCards}
              <p style="margin:0;text-align:center;font-size:14px;font-weight:700;color:#fff;">Mostrá el QR en la puerta</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 26px;border-top:1px solid #222;">
              <p style="margin:16px 0 0;font-size:13px;color:#999;">Guardá este mail o el PDF. En el predio puede no haber señal.</p>
              ${whatsappBlock}
              <p style="margin:12px 0 0;font-size:12px;color:#666;">${escapeHtml(evento.textoFooter || branding.textoFooter || organizador)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
