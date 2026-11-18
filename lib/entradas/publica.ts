import type { Orden } from "@/types";

/**
 * Compra sin los datos que no tienen que viajar al navegador: el DNI y la fecha de nacimiento son la
 * llave de "Recuperar mis entradas", y los ids de pago no le sirven al comprador (con ellos se podría
 * mandar avisos falsos al servidor). `pagoIniciado` dice si ya empezó un pago (para no mostrar
 * "se terminó el tiempo" a quien quizás ya transfirió).
 */
export function ordenPublica(orden: Orden) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { compradorDni, compradorNacimiento, pagosTalo, paymentId, ...resto } = orden;
  return { ...resto, pagoIniciado: Boolean(paymentId && !paymentId.startsWith("mock_")) || (pagosTalo?.length ?? 0) > 0 };
}

/** Compra para el panel: el DNI sí (para buscar), la fecha de nacimiento y la lista de pagos no. */
export function ordenAdmin(orden: Orden) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { compradorNacimiento, pagosTalo, ...resto } = orden;
  return resto;
}
