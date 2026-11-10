/**
 * Tope de pedidos por IP, en memoria del servidor.
 * No es infalible (en Vercel cada instancia tiene su memoria), pero frena a quien aprieta
 * el botón en loop o prueba PINs a lo bruto.
 */
interface Registro {
  n: number;
  desde: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __limites: Map<string, Map<string, Registro>> | undefined;
}

function tabla(nombre: string): Map<string, Registro> {
  if (!global.__limites) global.__limites = new Map();
  let t = global.__limites.get(nombre);
  if (!t) {
    t = new Map();
    global.__limites.set(nombre, t);
  }
  return t;
}

export function ipDe(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"
  );
}

export function crearLimite(nombre: string, max: number, ventanaMs: number) {
  function vigente(r: Registro | undefined, ahora: number): r is Registro {
    return Boolean(r) && ahora - r!.desde < ventanaMs;
  }
  return {
    /** true si esa clave ya llegó al tope dentro de la ventana. */
    bloqueado(clave: string, ahora = Date.now()): boolean {
      const r = tabla(nombre).get(clave);
      return vigente(r, ahora) && r.n >= max;
    },
    sumar(clave: string, ahora = Date.now()): void {
      const t = tabla(nombre);
      const r = t.get(clave);
      t.set(clave, vigente(r, ahora) ? { n: r.n + 1, desde: r.desde } : { n: 1, desde: ahora });
      // Limpieza para que la memoria no crezca sin fin.
      if (t.size > 5000) {
        t.forEach((v, k) => {
          if (ahora - v.desde >= ventanaMs) t.delete(k);
        });
      }
    },
    limpiar(clave: string): void {
      tabla(nombre).delete(clave);
    },
  };
}
