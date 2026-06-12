import { NextResponse } from "next/server";
import { cancelTicket } from "@/lib/mock/db";
import { requireRole } from "@/lib/auth/cookies";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!requireRole("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = cancelTicket(params.id, body.motivo);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ticket: result.ticket });
}
