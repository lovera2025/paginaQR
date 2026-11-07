"use client";

import { useEffect, useRef, useState } from "react";
import { EVENTO_ESTADO_LABELS } from "@/lib/evento/estado";
import { getEstiloEntrada } from "@/lib/entradas/estilos";
import { diaCorto, formatPrecio } from "@/lib/utils";
import type { AdminStats, Evento } from "@/types";

interface Fila {
  evento: Evento;
  stats: AdminStats;
}

const ESTADO_CLASE: Record<Evento["estado"], string> = {
  borrador: "bg-yellow-500/15 text-yellow-300",
  venta: "bg-green-500/15 text-green-300",
  pausado: "bg-amber-500/15 text-amber-200",
  finalizado: "bg-white/10 text-white/50",
};

/** Tabla de ventas de todas las fiestas: entradas vendidas, plata por tipo e ingresos. */
export function VentasGenerales({
  version,
  eventoSeleccionado,
  onSeleccionar,
}: {
  version: number;
  eventoSeleccionado: string;
  onSeleccionar: (id: string) => void;
}) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const ultima = useRef(0);
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Se actualiza con los cambios en vivo, pero como mucho cada 15 s (es una consulta pesada).
  useEffect(() => {
    const cargar = () => {
      ultima.current = Date.now();
      fetch("/api/admin/resumen", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setFilas(d.filas ?? []))
        .catch(() => setFilas((f) => f ?? []));
    };
    const espera = 15000 - (Date.now() - ultima.current);
    if (espera <= 0) cargar();
    else if (!pendiente.current) {
      pendiente.current = setTimeout(() => {
        pendiente.current = null;
        cargar();
      }, espera);
    }
  }, [version]);

  useEffect(() => () => {
    if (pendiente.current) clearTimeout(pendiente.current);
  }, []);

  if (!filas) return <p className="text-sm text-white/40">Cargando ventas…</p>;
  if (filas.length === 0) return null;

  const total = filas.reduce(
    (acc, f) => ({
      vendidas: acc.vendidas + f.stats.vendidasActivas,
      recaudado: acc.recaudado + f.stats.recaudado,
      ingresaron: acc.ingresaron + f.stats.ingresaron,
      compras: acc.compras + f.stats.totalOrdenes,
    }),
    { vendidas: 0, recaudado: 0, ingresaron: 0, compras: 0 }
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-xl font-extrabold">Ventas de todas las fiestas</h2>
        <p className="text-xs text-white/45">Tocá una fila para verla en detalle</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Recaudado total", v: formatPrecio(total.recaudado), c: "text-oro-claro" },
          { l: "Entradas vendidas", v: total.vendidas, c: "text-white" },
          { l: "Compras", v: total.compras, c: "text-white" },
          { l: "Ingresaron", v: total.ingresaron, c: "text-green-300" },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] tracking-[0.1em] text-white/50">{k.l.toUpperCase()}</p>
            <p className={`mt-1 font-display text-2xl font-extrabold ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/[0.04] text-[11px] tracking-[0.1em] text-white/50">
            <tr>
              <th className="px-4 py-3 font-semibold">FIESTA</th>
              <th className="px-4 py-3 font-semibold">ESTADO</th>
              <th className="px-4 py-3 font-semibold">VENDIDAS / AFORO</th>
              <th className="px-4 py-3 font-semibold">POR TIPO</th>
              <th className="px-4 py-3 font-semibold">RECAUDADO</th>
              <th className="px-4 py-3 font-semibold">INGRESARON</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ evento, stats }) => {
              const pct = stats.capacidad ? Math.min(100, (stats.vendidasActivas / stats.capacidad) * 100) : 0;
              const sel = evento.id === eventoSeleccionado;
              return (
                <tr
                  key={evento.id}
                  onClick={() => evento.estado !== "finalizado" && onSeleccionar(evento.id)}
                  className={`border-t border-white/[0.07] ${evento.estado !== "finalizado" ? "cursor-pointer hover:bg-white/[0.03]" : ""} ${sel ? "bg-oro/[0.07]" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-display text-[11px] font-extrabold tracking-[0.08em] text-oro">{diaCorto(evento.fecha)}</span>
                      <span className="max-w-[240px] truncate font-semibold">{evento.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO_CLASE[evento.estado]}`}>
                      {EVENTO_ESTADO_LABELS[evento.estado].split(" —")[0]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[120px] flex-col gap-1.5">
                      <span>
                        {stats.vendidasActivas} / {stats.capacidad}
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-oro" style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {stats.porTipo
                        .filter((p) => p.vendidas > 0)
                        .map((p) => {
                          const e = getEstiloEntrada({ estilo: p.estilo, colorEvento: evento.colorPrimario });
                          return (
                            <span
                              key={`${p.tipoEntradaId}-${p.nombre}`}
                              className="rounded-full border px-2 py-0.5 text-[11px]"
                              style={{ borderColor: `${e.acento}88`, color: e.acento }}
                              title={`${p.nombre}: ${formatPrecio(p.recaudado)}`}
                            >
                              {p.nombre} {p.vendidas}
                            </span>
                          );
                        })}
                      {stats.porTipo.every((p) => p.vendidas === 0) && <span className="text-xs text-white/35">Sin ventas</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-display font-bold text-oro-claro">{formatPrecio(stats.recaudado)}</td>
                  <td className="px-4 py-3 text-green-300">{stats.ingresaron}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
