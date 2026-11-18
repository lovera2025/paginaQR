import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { getOrdenesByEvento, getTicketsByEvento } from "@/lib/db";
import { ordenAdmin } from "@/lib/entradas/publica";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const [ordenes, tickets] = await Promise.all([
    getOrdenesByEvento(params.id),
    getTicketsByEvento(params.id),
  ]);
  return NextResponse.json({ ordenes: ordenes.map(ordenAdmin), tickets });
}
