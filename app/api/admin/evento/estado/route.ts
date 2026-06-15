import { NextResponse } from "next/server";
import { abrirVentaEvento, cerrarEventoActivo } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

export async function POST(request: Request) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { accion } = await request.json();
  if (accion !== "abrir_venta" && accion !== "cerrar") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const result =
    accion === "abrir_venta"
      ? await abrirVentaEvento()
      : await cerrarEventoActivo();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ evento: result.evento });
}
