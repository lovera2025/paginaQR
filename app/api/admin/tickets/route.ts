import { NextResponse } from "next/server";
import { getTickets } from "@/lib/db";
import { adminConEvento } from "@/lib/api/admin";

export async function GET(request: Request) {
  const ctx = await adminConEvento(request);
  if ("response" in ctx) return ctx.response;
  return NextResponse.json({ tickets: await getTickets(ctx.evento.id) });
}
