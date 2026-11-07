"use client";

import { useState } from "react";
import { IconCheck, IconCompartir } from "./iconos";

export function CompartirBoton({ titulo, className }: { titulo: string; className?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartir() {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* el usuario canceló */
    }
  }

  return (
    <button type="button" onClick={compartir} aria-label={copiado ? "Link copiado" : "Compartir"} className={className}>
      {copiado ? <IconCheck size={18} /> : <IconCompartir size={18} />}
    </button>
  );
}
