import { montoDevuelto } from "@/lib/entradas/tipos";
import { formatFechaCorta } from "@/lib/utils";
import type { Evento, Orden } from "@/types";

const ESTADOS: Record<Orden["estado"], string> = {
  pendiente: "Sin pagar",
  aprobado: "Pagada",
  rechazado: "Rechazada o vencida",
  reembolsado: "Anulada y devuelta",
};

/** Una celda segura para Excel: sin fórmulas inyectadas y con comillas escapadas. */
function celda(valor: string | number | null | undefined): string {
  let t = valor === null || valor === undefined ? "" : String(valor);
  if (typeof valor === "string" && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/**
 * Compras en formato CSV para abrir con Excel (separador ";", como lo espera Excel en español).
 * Sirve de respaldo propio: la base gratis no guarda copias de seguridad automáticas.
 */
export function comprasACsv(filas: { evento: Pick<Evento, "nombre">; orden: Orden }[]): string {
  const encabezado = [
    "Fecha",
    "Fiesta",
    "Comprador",
    "Email",
    "Entrada",
    "Cantidad",
    "Precio unitario",
    "Total",
    "Devuelto",
    "Estado",
    "Medio de pago",
    "Numero de pago",
    "Cobro",
    "Codigo de compra",
  ];
  const lineas = filas.map(({ evento, orden: o }) =>
    [
      formatFechaCorta(o.createdAt),
      evento.nombre,
      o.compradorNombre,
      o.compradorEmail,
      o.tipoNombre,
      o.cantidad,
      o.precioUnitario,
      o.montoTotal,
      montoDevuelto(o),
      o.problema === "pago_sin_cupo" && o.estado === "pendiente" ? "Pago sin cupo: devolver" : ESTADOS[o.estado],
      o.paymentMethod === "mp" ? "Mercado Pago" : o.paymentMethod === "talo" ? "Transferencia" : "",
      o.paymentId ?? "",
      o.modoPago === "produccion" ? "Real" : o.modoPago ? "Prueba" : "",
      o.id.slice(0, 8),
    ]
      .map(celda)
      .join(";")
  );
  // BOM para que Excel lea bien los acentos.
  return `﻿${[encabezado.join(";"), ...lineas].join("\r\n")}\r\n`;
}
