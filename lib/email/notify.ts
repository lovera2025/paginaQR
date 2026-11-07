import {
  claimEmailSend,
  getBranding,
  getEventoById,
  getOrden,
  getTicketsByOrden,
  releaseEmailSend,
} from "@/lib/db";
import { isResendConfigured } from "@/lib/config";
import { sendOrderConfirmationEmail } from "@/lib/email/send";

/**
 * Manda el mail de confirmación una sola vez por orden.
 * Reserva el envío antes de mandar (si falla, libera la reserva para reintentar).
 */
export async function notifyOrdenAprobada(ordenId: string): Promise<void> {
  const orden = await getOrden(ordenId);
  if (!orden || orden.estado !== "aprobado" || orden.emailSentAt) return;

  const [evento, tickets, branding] = await Promise.all([
    getEventoById(orden.eventoId),
    getTicketsByOrden(ordenId),
    getBranding(),
  ]);
  if (!evento || tickets.length === 0) return;

  if (!isResendConfigured()) {
    // Modo local: dejamos constancia en consola y no marcamos como enviado.
    await sendOrderConfirmationEmail({ orden, tickets, evento, branding });
    return;
  }

  if (!(await claimEmailSend(ordenId))) return;
  const result = await sendOrderConfirmationEmail({ orden, tickets, evento, branding });
  if (!result.sent) await releaseEmailSend(ordenId);
}
