import { Resend } from "resend";
import { getAppUrl, getResendFrom, isResendConfigured } from "@/lib/config";
import { generateQrDataUrl } from "@/lib/qr/generate";
import { buildConfirmationHtml, buildConfirmationSubject } from "@/lib/email/template";
import type { Evento, Orden, Ticket } from "@/types";

export type SendConfirmationResult =
  | { sent: true }
  | { sent: false; reason: "already_sent" | "not_configured" | "error"; error?: string };

export async function sendOrderConfirmationEmail(input: {
  orden: Orden;
  tickets: Ticket[];
  evento: Evento;
}): Promise<SendConfirmationResult> {
  const { orden, tickets, evento } = input;

  if (orden.emailSentAt) {
    return { sent: false, reason: "already_sent" };
  }

  if (!isResendConfigured()) {
    console.log(
      `[EMAIL SIMULADO] Enviado a ${orden.compradorEmail} — ${tickets.length} QR(s) para ${evento.nombre}`
    );
    return { sent: false, reason: "not_configured" };
  }

  const qrDataUrls = await Promise.all(
    tickets.map((ticket) => generateQrDataUrl(ticket.id))
  );

  const html = buildConfirmationHtml({
    orden,
    tickets,
    evento,
    qrDataUrls,
    appUrl: getAppUrl(),
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: getResendFrom(),
    to: orden.compradorEmail,
    subject: buildConfirmationSubject(evento),
    html,
  });

  if (error) {
    console.error("[EMAIL ERROR]", error);
    return { sent: false, reason: "error", error: error.message };
  }

  console.log(
    `[EMAIL ENVIADO] ${orden.compradorEmail} — ${tickets.length} QR(s) para ${evento.nombre}`
  );
  return { sent: true };
}
