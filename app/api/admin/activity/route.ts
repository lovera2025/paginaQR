import { NextResponse } from "next/server";
import { getActivity } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";

export async function GET() {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json({ activity: await getActivity() });
}
