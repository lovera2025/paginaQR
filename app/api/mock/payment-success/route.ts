import { NextResponse } from "next/server";
import { approveOrden } from "@/lib/db";
import { isMockMode } from "@/lib/config";

export async function POST(request: Request) {
  if (!isMockMode()) {
    return NextResponse.json({ error: "Solo en modo mock" }, { status: 403 });
  }

  const { ordenId } = await request.json();
  if (!ordenId) {
    return NextResponse.json({ error: "ordenId requerido" }, { status: 400 });
  }

  const result = await approveOrden(ordenId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    orden: result.orden,
    ticketIds: result.tickets.map((t) => t.id),
  });
}
