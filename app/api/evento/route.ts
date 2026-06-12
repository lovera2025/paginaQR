import { NextResponse } from "next/server";
import { getEventoActivo } from "@/lib/mock/db";

export async function GET() {
  const evento = getEventoActivo();
  if (!evento) {
    return NextResponse.json({ error: "No hay evento activo" }, { status: 404 });
  }
  return NextResponse.json(evento);
}
