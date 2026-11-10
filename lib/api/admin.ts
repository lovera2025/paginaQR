import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { resolveEventoAdmin } from "@/lib/db";
import type { Evento } from "@/types";

export function noAutorizado() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

export function errorJson(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** Lee `?evento=` de la URL. */
export function eventoIdFromUrl(request: Request): string | null {
  return new URL(request.url).searchParams.get("evento");
}

/**
 * Valida sesión admin y resuelve la fiesta (`?evento=` o la primera).
 * Devuelve una respuesta de error lista para retornar si algo falla.
 */
export async function adminConEvento(
  request: Request,
  eventoId?: string | null
): Promise<{ evento: Evento } | { response: NextResponse }> {
  if (!(await requireAuth("admin"))) return { response: noAutorizado() };
  const evento = await resolveEventoAdmin(eventoId ?? eventoIdFromUrl(request));
  if (!evento) return { response: errorJson("No hay fiestas cargadas", 404) };
  return { evento };
}
