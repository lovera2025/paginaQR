"use client";

import { useEffect, useState } from "react";
import { abrirEnChromeHref, esAndroid, esNavegadorInterno } from "@/lib/utils";

/**
 * Si la página está abierta dentro de Instagram, TikTok, Facebook, etc., avisa que el PDF puede no
 * bajarse ahí y ofrece abrirla en el navegador del celular (o copiar el link). En Chrome/Safari no se ve.
 */
export function AvisoNavegadorInterno({ className = "", enLista = false }: { className?: string; enLista?: boolean }) {
  const [info, setInfo] = useState<{ android: boolean; url: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (esNavegadorInterno(ua)) setInfo({ android: esAndroid(ua), url: window.location.href });
  }, []);

  if (!info) return null;

  // En "Mis entradas" la lista vive en este navegador: en Chrome no aparecería. Se abre cada compra.
  if (enLista) {
    return (
      <div role="note" className={`rounded-2xl border border-amber-400/45 bg-amber-400/10 p-4 text-sm ${className}`}>
        <p className="font-semibold text-amber-200">Estás en el navegador de una app (Instagram, TikTok…)</p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/80">
          Ahí el PDF puede no bajarse. Tocá “Ver QR” en tu compra y desde esa pantalla abrila en{" "}
          {info.android ? "Chrome" : "Safari"}. También sirve sacarle captura al QR.
        </p>
      </div>
    );
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(info!.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Copiá este link y abrilo en Chrome o Safari:", info!.url);
    }
  }

  return (
    <div role="note" className={`rounded-2xl border border-amber-400/45 bg-amber-400/10 p-4 text-sm ${className}`}>
      <p className="font-semibold text-amber-200">Estás en el navegador de una app (Instagram, TikTok…)</p>
      <p className="mt-1 text-[13px] leading-relaxed text-white/80">
        Ahí el PDF puede no bajarse. Abrí esta página en {info.android ? "Chrome" : "Safari"} para descargarlo
        {info.android ? "" : " (tocá ··· arriba y elegí “Abrir en el navegador”)"}. También sirve sacarle captura al QR.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {info.android && (
          <a href={abrirEnChromeHref(info.url)} className="btn-oro h-10 px-4 text-[13px]">
            Abrir en Chrome
          </a>
        )}
        <button type="button" onClick={copiar} className="btn-borde h-10 px-4 text-[13px]">
          {copiado ? "¡Link copiado!" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
