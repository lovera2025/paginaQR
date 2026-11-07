"use client";

import { useEffect, useState } from "react";

function partes(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    min: Math.floor((s % 3600) / 60),
    seg: s % 60,
  };
}

/** Cuenta regresiva a la fecha de la fiesta. Muestra "--" hasta montar (evita desfasaje de SSR). */
export function Countdown({ fecha, compacto = false }: { fecha: string; compacto?: boolean }) {
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const p = ahora === null ? null : partes(new Date(fecha).getTime() - ahora);
  const items = [
    { v: p?.dias, l: "DÍAS", oro: true },
    { v: p?.horas, l: "HS" },
    { v: p?.min, l: "MIN" },
    { v: p?.seg, l: "SEG" },
  ];

  return (
    <div className={`grid grid-cols-4 ${compacto ? "gap-1.5" : "gap-2"}`} role="timer" aria-live="off">
      {items.map((it) => (
        <div
          key={it.l}
          className={`flex flex-col items-center rounded-xl bg-black/45 ${compacto ? "min-w-[52px] py-2" : "py-2.5"}`}
        >
          <span
            className={`font-display font-extrabold tabular-nums ${compacto ? "text-xl" : "text-[26px]"} ${
              it.oro ? "text-oro" : "text-white"
            }`}
          >
            {it.v === undefined ? "--" : String(it.v).padStart(2, "0")}
          </span>
          <span className="text-[9px] tracking-[0.14em] text-white/55">{it.l}</span>
        </div>
      ))}
    </div>
  );
}
