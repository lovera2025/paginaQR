import { NextResponse } from "next/server";
import { verifyTicket } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("scanner"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const eventoId = typeof body.eventoId === "string" && body.eventoId ? body.eventoId : undefined;
  const ticketId = decodeURIComponent(params.id).trim();
  return NextResponse.json(await verifyTicket(ticketId, eventoId));
}
