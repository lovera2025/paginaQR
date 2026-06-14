import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/cookies";
import { getAdminPin, getScannerPin } from "@/lib/config";

export async function GET() {
  if (!requireRole("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const adminPin = getAdminPin();
  const scannerPin = getScannerPin();
  return NextResponse.json({
    adminPinDebil: adminPin === "1234",
    scannerPinDebil: scannerPin === "1234",
    ambosIguales: adminPin === scannerPin,
  });
}
