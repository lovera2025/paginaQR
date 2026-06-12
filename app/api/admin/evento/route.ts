import { NextResponse } from "next/server";
import { getEventoActivo, updateEvento } from "@/lib/db";
import { requireRole } from "@/lib/auth/cookies";

export async function GET() {
  if (!requireRole("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const evento = await getEventoActivo();
  if (!evento) {
    return NextResponse.json({ error: "No hay evento" }, { status: 404 });
  }
  return NextResponse.json(evento);
}

export async function PUT(request: Request) {
  if (!requireRole("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const evento = await updateEvento(body);
  return NextResponse.json(evento);
}
