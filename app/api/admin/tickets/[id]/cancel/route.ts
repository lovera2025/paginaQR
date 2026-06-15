import { NextResponse } from "next/server";
import { cancelTicket } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await cancelTicket(params.id, body.motivo);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ticket: result.ticket });
}
