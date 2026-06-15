import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/cookies";
import { getAppPins, isWeakPin } from "@/lib/auth/pins";

export async function GET() {
  if (!(await requireAuth("admin"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pins = await getAppPins();
  return NextResponse.json({
    adminPinDebil: isWeakPin(pins.adminPin),
    scannerPinDebil: isWeakPin(pins.scannerPin),
    ambosIguales: pins.adminPin === pins.scannerPin,
    storedInDb: pins.storedInDb,
  });
}
