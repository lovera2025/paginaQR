"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function partes(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    dias: Math.floor(s / 86400),
    horas: Math.floor((s % 86400) / 3600),
    min: Math.floor((s % 3600) / 60),
    seg: s % 60,
  };
}

/** Reloj que arranca recién al montar (evita desfasaje de SSR). */
function useAhora(): number | null {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

/** Cuando la cuenta llega a cero, recarga los datos de la página una sola vez (ej. abre la venta). */
function useRecargarAlTerminar(fecha: string, ahora: number | null, activo: boolean) {
  const router = useRouter();
  const hecho = useRef(false);
  useEffect(() => {
    if (!activo || ahora === null || hecho.current) return;
    if (new Date(fecha).getTime() - ahora <= 0) {
      hecho.current = true;
      // Un pequeño margen para que el servidor ya vea la fecha pasada.
      setTimeout(() => router.refresh(), 1500);
    }
  }, [activo, ahora, fecha, router]);
}

/** Cuenta regresiva grande. Muestra "--" hasta montar. */
export function Countdown({
  fecha,
  compacto = false,
  recargarAlTerminar = false,
}: {
  fecha: string;
  compacto?: boolean;
  recargarAlTerminar?: boolean;
}) {
  const ahora = useAhora();
  useRecargarAlTerminar(fecha, ahora, recargarAlTerminar);

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

/** Cuenta regresiva en una línea de texto: "Abre en 12 d 04 h 22 m". */
export function CuentaTexto({
  fecha,
  prefijo = "Abre en",
  recargarAlTerminar = false,
}: {
  fecha: string;
  prefijo?: string;
  recargarAlTerminar?: boolean;
}) {
  const ahora = useAhora();
  useRecargarAlTerminar(fecha, ahora, recargarAlTerminar);
  if (ahora === null) return <span>{prefijo} …</span>;
  const p = partes(new Date(fecha).getTime() - ahora);
  if (p.dias + p.horas + p.min + p.seg === 0) return <span>Abriendo…</span>;
  const pad = (n: number) => String(n).padStart(2, "0");
  const texto =
    p.dias > 0 ? `${p.dias} d ${pad(p.horas)} h ${pad(p.min)} m` : `${pad(p.horas)} h ${pad(p.min)} m ${pad(p.seg)} s`;
  return (
    <span className="tabular-nums">
      {prefijo} {texto}
    </span>
  );
}
