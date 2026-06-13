import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/cookies";
import { uploadEventoImage } from "@/lib/supabase/storage";

export async function POST(request: Request) {
  if (!requireRole("admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  const eventoId = form.get("eventoId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (kind !== "logo" && kind !== "flyer") {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  if (typeof eventoId !== "string" || !eventoId.trim()) {
    return NextResponse.json({ error: "eventoId requerido" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await uploadEventoImage(
    eventoId.trim(),
    kind,
    buffer,
    file.type,
    ext
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ url: result.url });
}
