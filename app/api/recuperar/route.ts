import { NextResponse } from "next/server";
import { contarIntentoRecuperar, getEventoById, getOrdenesPorDni, registrarActividad } from "@/lib/db";
import { normalizarDni, normalizarNacimiento } from "@/lib/entradas/identidad";
import { crearLimite, ipDe } from "@/lib/limite";
import { revisarPago } from "@/lib/payments/revisar";
import { idsTaloDe } from "@/lib/talo/payments";
import type { Orden } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Por IP (en memoria, frena ráfagas) y por DNI (guardado en la base: vale para todas las instancias y
// cuenta TODOS los intentos, aciertos incluidos, para que nadie pueda probar fechas sin gastar intentos).
const porIp = crearLimite("recuperar-ip", 15, 10 * 60 * 1000);
const VENTANA_DNI_MS = 30 * 60 * 1000;
const MAX_POR_DNI = 8;

const NO_ENCONTRADA =
  "No encontramos compras con esos datos. Revisá el DNI y la fecha de nacimiento que pusiste al comprar.";

export type EstadoRecuperada = "pagada" | "anulada" | "sin_cupo" | "de_menos" | "esperando";

export interface CompraRecuperada {
  ordenId: string;
  codigo: string;
  estado: EstadoRecuperada;
  cantidad: number;
  tipoNombre: string;
  montoTotal: number;
  montoRecibido: number | null;
  evento: { nombre: string; slug: string; fecha: string; lugar: string; flyerUrl: string; colorSecundario: string } | null;
}

function estadoDe(o: Orden): EstadoRecuperada | null {
  if (o.estado === "aprobado") return "pagada";
  if (o.estado === "reembolsado") return "anulada";
  if (o.montoRecibido != null && (o.estado === "pendiente" || o.estado === "rechazado")) return "de_menos";
  if (o.estado !== "pendiente") return null;
  if (o.problema === "pago_sin_cupo") return "sin_cupo";
  // Solo las que llegaron a iniciar un pago: las abandonadas antes de pagar no se muestran.
  return idsTaloDe(o).length > 0 || o.paymentMethod ? "esperando" : null;
}

/** IP sin el último número (para Actividad, sin guardar la dirección completa). */
function ipParcial(ip: string): string {
  const partes = ip.split(".");
  return partes.length === 4 ? `${partes.slice(0, 3).join(".")}.x` : ip.slice(0, 12);
}

/**
 * "Recuperar mis entradas": con el DNI y la fecha de nacimiento que puso al comprar, el comprador
 * vuelve a ver sus compras. Las que figuran sin pagar se consultan antes en Talo / Mercado Pago:
 * si la plata llegó se aprueban y se emiten las entradas en el momento. Nunca se muestra un QR
 * de una compra cuyo pago no se confirmó (las entradas solo existen si está aprobada).
 */
export async function POST(request: Request) {
  const ip = ipDe(request);
  if (porIp.bloqueado(ip)) {
    return NextResponse.json({ error: "Hiciste muchos intentos. Esperá unos minutos y probá de nuevo." }, { status: 429 });
  }
  porIp.sumar(ip);

  const body = await request.json().catch(() => ({}));
  const dni = normalizarDni(body.dni);
  const nacimiento = normalizarNacimiento(body.nacimiento);
  if (!dni || !nacimiento) {
    return NextResponse.json({ error: "Revisá el DNI (solo números) y la fecha de nacimiento." }, { status: 400 });
  }

  let intentos: number;
  try {
    intentos = await contarIntentoRecuperar(dni, VENTANA_DNI_MS);
  } catch {
    return NextResponse.json({ error: "No pudimos buscar tus compras. Probá de nuevo en un momento." }, { status: 503 });
  }
  if (intentos > MAX_POR_DNI) {
    return NextResponse.json({ error: "Hiciste muchos intentos. Esperá media hora y probá de nuevo." }, { status: 429 });
  }

  const candidatas = (await getOrdenesPorDni(dni)).filter((o) => o.compradorNacimiento === nacimiento);
  if (candidatas.length === 0) {
    return NextResponse.json({ error: NO_ENCONTRADA }, { status: 404 });
  }

  // Las sin pagar (o cerradas con una transferencia iniciada) se consultan antes: quizás la plata llegó.
  const revisadas = await Promise.all(
    candidatas.slice(0, 10).map(async (o) =>
      o.estado === "pendiente" || (o.estado === "rechazado" && idsTaloDe(o).length > 0)
        ? (await revisarPago(o).catch(() => ({ orden: o }))).orden
        : o
    )
  );

  const eventos = new Map<string, CompraRecuperada["evento"]>();
  const compras: CompraRecuperada[] = [];
  for (const o of revisadas) {
    const estado = estadoDe(o);
    if (!estado) continue;
    if (!eventos.has(o.eventoId)) {
      const ev = await getEventoById(o.eventoId);
      eventos.set(
        o.eventoId,
        ev
          ? { nombre: ev.nombre, slug: ev.slug, fecha: ev.fecha, lugar: ev.lugar, flyerUrl: ev.flyerUrl, colorSecundario: ev.colorSecundario }
          : null
      );
    }
    compras.push({
      ordenId: o.id,
      codigo: o.id.slice(0, 8).toUpperCase(),
      estado,
      cantidad: o.cantidad,
      tipoNombre: o.tipoNombre,
      montoTotal: o.montoTotal,
      montoRecibido: o.montoRecibido ?? null,
      evento: eventos.get(o.eventoId) ?? null,
    });
  }

  if (compras.length === 0) {
    return NextResponse.json({ error: NO_ENCONTRADA }, { status: 404 });
  }
  // Queda registrado en el panel: si alguien saca entradas ajenas, el jefe lo puede ver.
  await registrarActividad(
    "pago",
    `Recuperar mis entradas: ${compras.map((c) => c.codigo).join(", ")} (desde ${ipParcial(ip)})`
  );
  return NextResponse.json({ compras });
}
