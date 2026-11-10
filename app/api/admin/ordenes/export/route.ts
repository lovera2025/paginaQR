import { getEventoById, getEventosAdmin, getEventosFinalizados, getOrdenes } from "@/lib/db";
import { errorJson, noAutorizado } from "@/lib/api/admin";
import { requireAuth } from "@/lib/auth/cookies";
import { comprasACsv } from "@/lib/exportar";

export const dynamic = "force-dynamic";

/** Descarga las compras (de una fiesta con ?evento=, o de todas) como archivo para Excel. */
export async function GET(request: Request) {
  if (!(await requireAuth("admin"))) return noAutorizado();

  const eventoId = new URL(request.url).searchParams.get("evento");
  let eventos;
  if (eventoId) {
    const evento = await getEventoById(eventoId);
    if (!evento) return errorJson("Fiesta no encontrada", 404);
    eventos = [evento];
  } else {
    const [activos, finalizados] = await Promise.all([getEventosAdmin(), getEventosFinalizados()]);
    eventos = [...activos, ...finalizados];
  }

  const filas = (
    await Promise.all(
      eventos.map(async (evento) => (await getOrdenes(evento.id)).map((orden) => ({ evento, orden })))
    )
  ).flat();

  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
  const nombre = `compras-${eventoId ? eventos[0].slug : "todas"}-${hoy}.csv`;
  return new Response(comprasACsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
