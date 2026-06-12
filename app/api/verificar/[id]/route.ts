import { NextResponse } from "next/server";
import { verifyTicket } from "@/lib/db";
import { requireRole } from "@/lib/auth/cookies";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!requireRole("scanner")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await verifyTicket(params.id);
  return NextResponse.json(result);
}
