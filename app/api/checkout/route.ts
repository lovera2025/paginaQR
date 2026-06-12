import { NextResponse } from "next/server";
import { createOrdenPendiente } from "@/lib/mock/db";
import { isMockMode } from "@/lib/config";

export async function POST(request: Request) {
  if (!isMockMode()) {
    return NextResponse.json(
      { error: "Checkout real disponible en Fase C" },
      { status: 501 }
    );
  }

  const body = await request.json();
  const result = createOrdenPendiente({
    compradorNombre: body.compradorNombre ?? "",
    compradorEmail: body.compradorEmail ?? "",
    cantidad: Number(body.cantidad) || 1,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ordenId: result.orden.id, orden: result.orden });
}
