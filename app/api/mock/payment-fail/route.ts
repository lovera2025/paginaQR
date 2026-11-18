import { NextResponse } from "next/server";
import { rejectOrden } from "@/lib/db";
import { ordenPublica } from "@/lib/entradas/publica";
import { canSimulatePayment } from "@/lib/talo/credentials";

export async function POST(request: Request) {
  if (!(await canSimulatePayment())) {
    return NextResponse.json({ error: "Simulación no disponible" }, { status: 403 });
  }

  const { ordenId } = await request.json();
  if (!ordenId) {
    return NextResponse.json({ error: "ordenId requerido" }, { status: 400 });
  }

  const result = await rejectOrden(ordenId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ orden: ordenPublica(result.orden) });
}
