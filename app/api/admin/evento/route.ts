import { NextResponse } from "next/server";
import { updateEvento } from "@/lib/db";
import { adminConEvento, errorJson } from "@/lib/api/admin";
import { isSlugValido } from "@/lib/entradas/tipos";

export async function GET(request: Request) {
  const ctx = await adminConEvento(request);
  if ("response" in ctx) return ctx.response;
  return NextResponse.json(ctx.evento);
}

export async function PUT(request: Request) {
  const ctx = await adminConEvento(request);
  if ("response" in ctx) return ctx.response;

  const body = await request.json();
  if (body.slug !== undefined) {
    body.slug = String(body.slug).trim().toLowerCase();
    if (!isSlugValido(body.slug)) {
      return errorJson("El link solo puede tener letras minúsculas, números y guiones");
    }
  }
  if (body.capacidad !== undefined && !(Number(body.capacidad) >= 1)) {
    return errorJson("La capacidad debe ser al menos 1");
  }

  const result = await updateEvento(ctx.evento.id, body);
  if ("error" in result) return errorJson(result.error);
  return NextResponse.json(result);
}
