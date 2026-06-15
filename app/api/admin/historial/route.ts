import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { getHistorialItems } from "@/lib/db";

export async function GET() {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const items = await getHistorialItems();
  return NextResponse.json({ items });
}
