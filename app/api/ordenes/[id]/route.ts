import { NextResponse } from "next/server";
import { getOrden } from "@/lib/mock/db";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const orden = getOrden(params.id);
  if (!orden) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  return NextResponse.json(orden);
}
