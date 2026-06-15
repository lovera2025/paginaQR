import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { crearNuevoEvento } from "@/lib/db";
import type { NuevoEventoInput } from "@/types";

export async function POST(request: Request) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json()) as NuevoEventoInput;

  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!body.fecha) {
    return NextResponse.json({ error: "La fecha es obligatoria" }, { status: 400 });
  }
  if (!(body.precio > 0)) {
    return NextResponse.json({ error: "El precio debe ser mayor a 0" }, { status: 400 });
  }
  if (!(body.capacidad >= 1)) {
    return NextResponse.json({ error: "La capacidad debe ser al menos 1" }, { status: 400 });
  }

  const result = await crearNuevoEvento({
    nombre: body.nombre,
    fecha: body.fecha,
    precio: Number(body.precio),
    capacidad: Number(body.capacidad),
    copiarBranding: Boolean(body.copiarBranding),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ evento: result.evento });
}
