import { NextResponse } from "next/server";
import { anularTickets } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

/**
 * Anula entradas de una compra a mano (el comprador avisó por WhatsApp y el jefe devolvió la plata).
 * Body: { ticketIds: string[], motivo: string, devolverPlata: boolean }
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ticketIds = Array.isArray(body.ticketIds) ? body.ticketIds.map(String) : [];
  const result = await anularTickets({
    ordenId: params.id,
    ticketIds,
    motivo: String(body.motivo ?? ""),
    devolverPlata: body.devolverPlata === true,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
