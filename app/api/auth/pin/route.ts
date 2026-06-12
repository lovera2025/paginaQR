import { NextResponse } from "next/server";
import { setAuthCookie, type AuthRole } from "@/lib/auth/cookies";
import { getAdminPin, getScannerPin } from "@/lib/config";

export async function POST(request: Request) {
  const { pin, role } = (await request.json()) as {
    pin: string;
    role: AuthRole;
  };

  if (!pin || !role) {
    return NextResponse.json({ error: "PIN y rol requeridos" }, { status: 400 });
  }

  const validPin =
    role === "admin" ? pin === getAdminPin() : pin === getScannerPin();

  if (!validPin) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  setAuthCookie(role);
  return NextResponse.json({ ok: true, role });
}
