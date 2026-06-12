import { NextResponse } from "next/server";
import { getAuthRole } from "@/lib/auth/cookies";

export async function GET() {
  return NextResponse.json({ role: getAuthRole() });
}
