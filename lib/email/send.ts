import { Resend } from "resend";
import { buildEmailInlineAssets } from "@/lib/email/attachments";
import { getResendFrom, isResendConfigured } from "@/lib/config";
import { buildConfirmationHtml, buildConfirmationSubject } from "@/lib/email/template";
import type { Branding, Evento, Orden, Ticket } from "@/types";

export type SendConfirmationResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "error"; error?: string };

/** Envía el mail. La idempotencia la maneja `notifyOrdenAprobada`. */
export async function sendOrderConfirmationEmail(input: {
  orden: Orden;
  tickets: Ticket[];
  evento: Evento;
  branding: Branding;
}): Promise<SendConfirmationResult> {
  const { orden, tickets, evento, branding } = input;
  const activos = tickets.filter((t) => !t.cancelado);

  if (!isResendConfigured()) {
    console.log(
      `[EMAIL SIMULADO] ${orden.compradorEmail} — ${activos.length} × ${orden.tipoNombre} para ${evento.nombre}`
    );
    return { sent: false, reason: "not_configured" };
  }

  const { attachments, flyerCid, logoCid, qrCids } = await buildEmailInlineAssets(evento, activos);
  const html = buildConfirmationHtml({ orden, tickets: activos, evento, branding, flyerCid, logoCid, qrCids });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: getResendFrom(),
    to: orden.compradorEmail,
    subject: buildConfirmationSubject(evento, orden),
    html,
    attachments,
  });

  if (error) {
    console.error("[EMAIL ERROR]", error);
    return { sent: false, reason: "error", error: error.message };
  }

  console.log(`[EMAIL ENVIADO] ${orden.compradorEmail} — ${activos.length} QR(s) para ${evento.nombre}`);
  return { sent: true };
}
