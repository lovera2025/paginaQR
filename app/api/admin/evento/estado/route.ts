import { NextResponse } from "next/server";
import { abrirVenta, cerrarEvento, pausarVentas, reanudarVentas } from "@/lib/db";
import { adminConEvento, errorJson } from "@/lib/api/admin";

const ACCIONES = ["abrir_venta", "pausar", "reanudar", "cerrar"] as const;

export async function POST(request: Request) {
  const body = await request.json();
  const ctx = await adminConEvento(request, body.eventoId);
  if ("response" in ctx) return ctx.response;

  const { accion } = body;
  if (!ACCIONES.includes(accion)) return errorJson("Acción inválida");

  const id = ctx.evento.id;
  const result =
    accion === "abrir_venta"
      ? await abrirVenta(id)
      : accion === "pausar"
        ? await pausarVentas(id)
        : accion === "reanudar"
          ? await reanudarVentas(id)
          : await cerrarEvento(id);

  if ("error" in result) return errorJson(result.error);
  return NextResponse.json({ evento: result.evento });
}
