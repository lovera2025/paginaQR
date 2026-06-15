import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { testTaloConnection } from "@/lib/talo/payments";

export async function POST() {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await testTaloConnection();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Conexión con Talo OK",
    environment: result.environment,
  });
}
