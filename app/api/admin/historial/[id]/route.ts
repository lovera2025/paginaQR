import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/cookies";
import { getOrdenesByEvento, getTicketsByEvento } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!requireRole("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const [ordenes, tickets] = await Promise.all([
    getOrdenesByEvento(params.id),
    getTicketsByEvento(params.id),
  ]);
  return NextResponse.json({ ordenes, tickets });
}
