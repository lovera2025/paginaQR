import { formatFecha } from "@/lib/utils";
import type { Evento, Orden, Ticket } from "@/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absoluteAssetUrl(path: string, appUrl: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = appUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatFechaAsunto(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function buildConfirmationSubject(evento: Evento): string {
  return `Tu entrada — ${evento.nombre} · ${formatFechaAsunto(evento.fecha)}`;
}

export function buildConfirmationHtml(input: {
  orden: Orden;
  tickets: Ticket[];
  evento: Evento;
  qrDataUrls: string[];
  appUrl: string;
}): string {
  const { orden, tickets, evento, qrDataUrls, appUrl } = input;
  const color = evento.colorPrimario || "#ff006e";
  const flyerUrl = absoluteAssetUrl(evento.flyerUrl, appUrl);
  const logoUrl = absoluteAssetUrl(evento.logoUrl, appUrl);
  const organizador = evento.organizadorNombre || "JR Eventos";
  const lugar = escapeHtml(evento.lugar || "A confirmar");
  const mapsLink = evento.mapsUrl?.trim()
    ? `<p style="margin:8px 0 0;font-size:14px;"><a href="${escapeHtml(evento.mapsUrl)}" style="color:${color};">Ver en mapa</a></p>`
    : "";

  const flyerBlock = flyerUrl
    ? `<img src="${escapeHtml(flyerUrl)}" alt="${escapeHtml(evento.nombre)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:12px 12px 0 0;" />`
    : "";

  const logoBlock =
    logoUrl && logoUrl !== flyerUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(organizador)}" width="48" height="48" style="display:inline-block;width:48px;height:48px;border-radius:8px;vertical-align:middle;margin-right:10px;" />`
      : "";

  const ticketCards = tickets
    .map((ticket, index) => {
      const qr = qrDataUrls[index] ?? "";
      const label =
        ticket.totalEntradas > 1
          ? `Entrada ${ticket.numeroEntrada} de ${ticket.totalEntradas}`
          : "Tu entrada";
      return `
        <div style="margin:0 0 20px;padding:20px;background:#ffffff;border:2px solid ${color};border-radius:16px;text-align:center;">
          <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.05em;">${label}</p>
          <img src="${qr}" alt="QR entrada ${ticket.numeroEntrada}" width="280" height="280" style="display:block;margin:0 auto;width:280px;height:280px;" />
        </div>`;
    })
    .join("");

  const whatsapp = evento.contactoWhatsapp?.trim()
    ? `<p style="margin:16px 0 0;font-size:14px;color:#666;">Dudas: <a href="https://wa.me/${evento.contactoWhatsapp.replace(/\D/g, "")}" style="color:${color};">WhatsApp</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111;border-radius:16px;overflow:hidden;color:#fff;">
          <tr><td>${flyerBlock}</td></tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <div style="margin-bottom:16px;">${logoBlock}<span style="font-size:18px;font-weight:700;vertical-align:middle;">${escapeHtml(organizador)}</span></div>
              <h1 style="margin:0 0 8px;font-size:26px;line-height:1.2;color:#fff;">${escapeHtml(evento.nombre)}</h1>
              <p style="margin:0;font-size:16px;color:#ddd;">${escapeHtml(formatFecha(evento.fecha))}</p>
              <p style="margin:8px 0 0;font-size:15px;color:#ccc;">${lugar}</p>
              ${mapsLink}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;">
              <p style="margin:0 0 8px;font-size:16px;">Hola <strong>${escapeHtml(orden.compradorNombre)}</strong>,</p>
              <p style="margin:0;font-size:16px;color:#ddd;">Confirmamos tu compra: <strong>${orden.cantidad}</strong> entrada${orden.cantidad > 1 ? "s" : ""}.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;">
              ${ticketCards}
              <p style="margin:0;text-align:center;font-size:15px;font-weight:700;color:#fff;">Presentá este QR en la entrada</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;border-top:1px solid #333;">
              <p style="margin:16px 0 0;font-size:13px;color:#999;">Guardá este mail — lo vas a necesitar en la puerta.</p>
              ${whatsapp}
              <p style="margin:12px 0 0;font-size:12px;color:#666;">${escapeHtml(evento.textoFooter || "JR Eventos")}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
