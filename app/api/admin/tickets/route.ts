import { NextResponse } from "next/server";
import { getTickets } from "@/lib/db";
import { requireRole } from "@/lib/auth/cookies";

export async function GET() {
  if (!requireRole("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json({ tickets: await getTickets() });
}
