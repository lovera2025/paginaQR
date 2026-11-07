import { NextResponse } from "next/server";
import { getCatalogo } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Catálogo público: fiestas en venta o pausadas, con precio "desde" y disponibilidad. */
export async function GET() {
  return NextResponse.json({ eventos: await getCatalogo() });
}
