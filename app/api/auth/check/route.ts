import { NextResponse } from "next/server";
import { clearAuthCookie, getAuthSession } from "@/lib/auth/cookies";
import { getAppPins } from "@/lib/auth/pins";

export async function GET() {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ role: null, stale: false });
  }

  const pins = await getAppPins();
  if (session.pinRevision !== pins.pinRevision) {
    clearAuthCookie();
    return NextResponse.json({ role: null, stale: true });
  }

  return NextResponse.json({ role: session.role, stale: false });
}
