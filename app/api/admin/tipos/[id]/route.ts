import { NextResponse } from "next/server";
import { deleteTipo, getTipoById, updateTipo } from "@/lib/db";
import { errorJson, noAutorizado } from "@/lib/api/admin";
import { requireAuth } from "@/lib/auth/cookies";
import { normalizarTipoInput } from "@/lib/entradas/tipos";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("admin"))) return noAutorizado();
  const actual = await getTipoById(params.id);
  if (!actual) return errorJson("Tipo no encontrado", 404);

  const parsed = normalizarTipoInput(await request.json(), true);
  if ("error" in parsed) return errorJson(parsed.error);

  const desde = parsed.value.ventaDesde !== undefined ? parsed.value.ventaDesde : actual.ventaDesde;
  const hasta = parsed.value.ventaHasta !== undefined ? parsed.value.ventaHasta : actual.ventaHasta;
  if (desde && hasta && desde >= hasta) {
    return errorJson("'Venta desde' tiene que ser anterior a 'venta hasta'");
  }

  const result = await updateTipo(params.id, parsed.value);
  if ("error" in result) return errorJson(result.error);
  return NextResponse.json({ tipo: result });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!(await requireAuth("admin"))) return noAutorizado();
  const result = await deleteTipo(params.id);
  if ("error" in result) return errorJson(result.error);
  return NextResponse.json({ ok: true });
}
