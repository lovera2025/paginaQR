/** Texto del aviso para el público (null = cobros reales, no se muestra nada). Sirve en server y client. */
export function avisoModoPrueba(modo: { simulate: boolean; sandbox: boolean }): string | null {
  if (modo.simulate) return "MODO SIMULACIÓN · no se cobra nada";
  if (modo.sandbox) return "MODO PRUEBA · los pagos no son reales";
  return null;
}
