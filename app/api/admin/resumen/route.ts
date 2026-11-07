import { NextResponse } from "next/server";
import { getResumenGeneral } from "@/lib/db";
import { noAutorizado } from "@/lib/api/admin";
import { requireAuth } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

/** Ventas por fiesta (cantidad, plata, desglose por tipo) de todas las fiestas. */
export async function GET() {
  if (!(await requireAuth("admin"))) return noAutorizado();
  return NextResponse.json({ filas: await getResumenGeneral() });
}
