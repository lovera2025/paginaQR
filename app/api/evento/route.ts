import { NextResponse } from "next/server";
import { getEventoActivo } from "@/lib/db";

export async function GET() {
  const evento = await getEventoActivo();
  if (!evento) {
    return NextResponse.json({ error: "No hay evento activo" }, { status: 404 });
  }
  return NextResponse.json(evento);
}
