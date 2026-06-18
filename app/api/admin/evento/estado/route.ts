import { NextResponse } from "next/server";
import {
  abrirVentaEvento,
  cerrarEventoActivo,
  pausarVentasEvento,
  reanudarVentasEvento,
} from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

const ACCIONES = ["abrir_venta", "pausar", "reanudar", "cerrar"] as const;

export async function POST(request: Request) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { accion } = await request.json();
  if (!ACCIONES.includes(accion)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const result =
    accion === "abrir_venta"
      ? await abrirVentaEvento()
      : accion === "pausar"
        ? await pausarVentasEvento()
        : accion === "reanudar"
          ? await reanudarVentasEvento()
          : await cerrarEventoActivo();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ evento: result.evento });
}
