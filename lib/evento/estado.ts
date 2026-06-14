import type { EventoEstado } from "@/types";

export const EVENTO_ESTADO_LABELS: Record<EventoEstado, string> = {
  borrador: "Borrador — pruebas",
  venta: "Venta abierta",
  finalizado: "Finalizado",
};

export function canResetVentas(estado: EventoEstado): boolean {
  return estado === "borrador";
}

export function canAbrirVenta(estado: EventoEstado): boolean {
  return estado === "borrador";
}

export function canCerrarEvento(estado: EventoEstado): boolean {
  return estado === "venta";
}

export function canComprarPublico(estado: EventoEstado): boolean {
  return estado === "borrador" || estado === "venta";
}
