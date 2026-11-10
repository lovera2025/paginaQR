import { NextResponse } from "next/server";
import { getBranding, getEventosAdmin } from "@/lib/db";
import { noAutorizado } from "@/lib/api/admin";
import { requireAuth } from "@/lib/auth/cookies";
import { getAppPins, isWeakPin } from "@/lib/auth/pins";
import { fiestaEnProximamente } from "@/lib/entradas/tipos";
import { cobraDeVerdad, getModoPagos } from "@/lib/payments/modo";

/** Estado de cada paso de la guía de puesta en marcha del panel. */
export async function GET() {
  if (!(await requireAuth("admin"))) return noAutorizado();

  const [branding, pins, modo, eventos] = await Promise.all([
    getBranding(),
    getAppPins(),
    getModoPagos(),
    getEventosAdmin(),
  ]);

  const publicadas = eventos.filter((e) => e.estado === "venta");
  return NextResponse.json({
    whatsapp: Boolean(branding.contactoWhatsapp.replace(/\D/g, "")),
    pins: !isWeakPin(pins.adminPin) && !isWeakPin(pins.scannerPin) && pins.adminPin !== pins.scannerPin,
    cobros: cobraDeVerdad(modo) ? "real" : modo.sinMedios ? "sin" : "prueba",
    total: eventos.length,
    borrador: eventos.filter((e) => e.estado === "borrador").length,
    publicadas: publicadas.length,
    enProximamente: publicadas.filter((e) => fiestaEnProximamente(e)).length,
  });
}
