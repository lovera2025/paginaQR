import { getModoPagos } from "@/lib/payments/modo";
import { avisoModoPrueba } from "@/lib/payments/aviso";
import { BarraModoPrueba } from "./BarraModoPrueba";

/** Aviso (server) cuando los pagos son simulados o de prueba. Con cobros reales no se ve. */
export async function AvisoModoPrueba({ sticky = true }: { sticky?: boolean }) {
  return <BarraModoPrueba texto={avisoModoPrueba(await getModoPagos())} sticky={sticky} />;
}
