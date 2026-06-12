import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth/cookies";

export async function POST() {
  clearAuthCookie();
  return NextResponse.json({ ok: true });
}
