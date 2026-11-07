import { NextResponse } from "next/server";
import { getBranding, updateBranding } from "@/lib/db";
import { errorJson, noAutorizado } from "@/lib/api/admin";
import { requireAuth } from "@/lib/auth/cookies";
import type { Branding } from "@/types";

const CAMPOS: (keyof Branding)[] = [
  "nombre",
  "logoUrl",
  "tagline",
  "contactoWhatsapp",
  "contactoInstagram",
  "contactoEmail",
  "textoFooter",
  "colorPrimario",
  "colorSecundario",
];

export async function GET() {
  if (!(await requireAuth("admin"))) return noAutorizado();
  return NextResponse.json(await getBranding());
}

export async function PUT(request: Request) {
  if (!(await requireAuth("admin"))) return noAutorizado();
  const body = await request.json();
  const data: Partial<Branding> = {};
  for (const campo of CAMPOS) {
    if (body[campo] !== undefined) data[campo] = String(body[campo]).trim();
  }
  if (data.contactoInstagram) data.contactoInstagram = data.contactoInstagram.replace(/^@/, "");
  for (const c of ["colorPrimario", "colorSecundario"] as const) {
    if (data[c] && !/^#[0-9a-fA-F]{6}$/.test(data[c]!)) return errorJson("Color inválido (usá #RRGGBB)");
  }
  const result = await updateBranding(data);
  if ("error" in result) return errorJson(result.error);
  return NextResponse.json(result);
}
