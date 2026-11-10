import { NextResponse } from "next/server";
import { getEventosAdmin } from "@/lib/db";
import { noAutorizado } from "@/lib/api/admin";
import { requireAuth } from "@/lib/auth/cookies";

/** Fiestas no finalizadas (borrador, venta, pausado) para el selector del admin y del scanner. */
export async function GET() {
  if (!(await requireAuth("scanner"))) return noAutorizado();
  return NextResponse.json({ eventos: await getEventosAdmin() });
}
