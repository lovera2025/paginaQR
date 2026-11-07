import { NextResponse } from "next/server";
import { getAdminStats } from "@/lib/db";
import { adminConEvento } from "@/lib/api/admin";

export async function GET(request: Request) {
  const ctx = await adminConEvento(request);
  if ("response" in ctx) return ctx.response;
  return NextResponse.json(await getAdminStats(ctx.evento.id));
}
