import type { EventoEstado } from "@/types";

export const EVENTO_ESTADO_LABELS: Record<EventoEstado, string> = {
  borrador: "Borrador — pruebas",
  venta: "Venta abierta",
  pausado: "Ventas pausadas",
  finalizado: "Finalizado",
};

export function canResetVentas(estado: EventoEstado): boolean {
  return estado === "borrador";
}

export function canAbrirVenta(estado: EventoEstado): boolean {
  return estado === "borrador";
}

export function canPausarVentas(estado: EventoEstado): boolean {
  return estado === "venta";
}

export function canReanudarVentas(estado: EventoEstado): boolean {
  return estado === "pausado";
}

export function canCerrarEvento(estado: EventoEstado): boolean {
  return estado === "venta" || estado === "pausado";
}

export function canComprarPublico(estado: EventoEstado): boolean {
  return estado === "borrador" || estado === "venta";
}

export function isVentasPausadas(estado: EventoEstado): boolean {
  return estado === "pausado";
}
