import { NextResponse } from "next/server";
import { refundOrden } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await refundOrden(params.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ orden: result.orden });
}
