import { NextResponse } from "next/server";
import { rejectOrden } from "@/lib/mock/db";
import { isMockMode } from "@/lib/config";

export async function POST(request: Request) {
  if (!isMockMode()) {
    return NextResponse.json({ error: "Solo en modo mock" }, { status: 403 });
  }

  const { ordenId } = await request.json();
  if (!ordenId) {
    return NextResponse.json({ error: "ordenId requerido" }, { status: 400 });
  }

  const result = rejectOrden(ordenId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ orden: result.orden });
}
