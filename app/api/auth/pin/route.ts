import { NextResponse } from "next/server";
import { setAuthCookie, type AuthRole } from "@/lib/auth/cookies";
import { getAppPins, validatePinForRole } from "@/lib/auth/pins";

export async function POST(request: Request) {
  const { pin, role } = (await request.json()) as {
    pin: string;
    role: AuthRole;
  };

  if (!pin || !role) {
    return NextResponse.json({ error: "PIN y rol requeridos" }, { status: 400 });
  }

  const valid = await validatePinForRole(role, pin);
  if (!valid) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const pins = await getAppPins();
  setAuthCookie(role, pins.pinRevision);
  return NextResponse.json({ ok: true, role });
}
