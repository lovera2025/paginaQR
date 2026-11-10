"use client";

import { useCallback, useEffect, useState } from "react";
import { getEstiloEntrada } from "@/lib/entradas/estilos";
import { fiestaEnProximamente, tipoEnProximamente } from "@/lib/entradas/tipos";
import { ddmm, formatPrecio, horaCorta, isoToDatetimeLocalAr } from "@/lib/utils";
import type { Evento, TipoEntradaDisponible } from "@/types";

type Apertura = "confirmar" | "fecha";

interface Editor {
  tipo: TipoEntradaDisponible;
  precio: string;
  /** Solo si el tipo todavía no abrió. */
  apertura: Apertura | null;
  ventaDesde: string;
  /** Se ofrece mientras el tipo (o la fiesta entera) está en Próximamente. */
  opcionPrecio: boolean;
  mostrarPrecio: boolean;
}

interface Props {
  evento: Evento;
  /** Cambia cuando el panel se actualiza: vuelve a leer los tipos. */
  version: number;
  /** Fiestas sin finalizar, para "aplicar a todas". */
  totalFiestas: number;
  onToast: (type: "success" | "error", text: string) => void;
  onChanged: () => void;
  /** Ir a "Entradas y precios" (cupos, diseño, tipos nuevos). */
  onVerTodo: () => void;
  /** Sacar la fiesta entera de "Próximamente". */
  onAbrirFiesta: () => void;
}

function Chip({ texto, clase }: { texto: string; clase: string }) {
  return <span className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold ${clase}`}>{texto}</span>;
}

/**
 * Las etapas de venta de una fiesta (Anticipada → General → VIP) de un vistazo, con las acciones
 * de todos los días a un toque: cambiar precio, abrir, cerrar o poner fecha de apertura.
 */
export function EtapasVenta({ evento, version, totalFiestas, onToast, onChanged, onVerTodo, onAbrirFiesta }: Props) {
  const [tipos, setTipos] = useState<TipoEntradaDisponible[] | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [enTodas, setEnTodas] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/admin/tipos?evento=${evento.id}`, { cache: "no-store" });
    const d = await r.json();
    setTipos(d.tipos ?? []);
  }, [evento.id]);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  useEffect(() => {
    setEditor(null);
    setEnTodas(false);
  }, [evento.id]);

  const otras = Math.max(0, totalFiestas - 1);
  const fiestaProx = fiestaEnProximamente(evento);
  const alcance = enTodas && otras > 0 ? ` en las ${totalFiestas} fiestas` : "";

  async function aplicar(t: TipoEntradaDisponible, cambio: Record<string, unknown>, ok: string): Promise<boolean> {
    setOcupado(true);
    try {
      const res = await fetch(`/api/admin/tipos/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cambio, aplicarATodas: enTodas && otras > 0 }),
      });
      const d = await res.json();
      if (!res.ok) {
        onToast("error", d.error ?? "No se pudo guardar");
        return false;
      }
      const extra = enTodas && otras > 0 ? ` · también en ${d.otras ?? 0} ${d.otras === 1 ? "fiesta" : "fiestas"} más` : "";
      const omitidas = Array.isArray(d.omitidas) && d.omitidas.length > 0 ? ` (sin cambios en: ${d.omitidas.join(", ")})` : "";
      onToast("success", `${ok}${extra}${omitidas}`);
      await cargar();
      onChanged();
      return true;
    } finally {
      setOcupado(false);
    }
  }

  function abrirEditor(t: TipoEntradaDisponible) {
    const sinAbrir = tipoEnProximamente(t);
    setEditor({
      tipo: t,
      precio: String(t.precio),
      apertura: sinAbrir ? (t.ventaDesde ? "fecha" : "confirmar") : null,
      ventaDesde: t.ventaDesde ? isoToDatetimeLocalAr(t.ventaDesde) : "",
      opcionPrecio: sinAbrir || fiestaProx,
      mostrarPrecio: t.mostrarPrecioPrevio,
    });
  }

  async function guardarEditor(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    const precio = Number(editor.precio);
    if (!(precio > 0)) {
      onToast("error", "El precio debe ser mayor a 0");
      return;
    }
    const cambio: Record<string, unknown> = { precio };
    if (editor.apertura) {
      if (editor.apertura === "fecha" && !editor.ventaDesde) {
        onToast("error", "Elegí el día y la hora en que abre la venta");
        return;
      }
      cambio.proximamente = true;
      cambio.ventaDesde = editor.apertura === "fecha" ? `${editor.ventaDesde}:00-03:00` : null;
    }
    if (editor.opcionPrecio) cambio.mostrarPrecioPrevio = editor.mostrarPrecio;
    if (await aplicar(editor.tipo, cambio, `${editor.tipo.nombre} actualizada`)) setEditor(null);
  }

  const activos = (tipos ?? []).filter((t) => t.activo);
  const ocultos = (tipos ?? []).length - activos.length;

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5" aria-label="Etapas de venta">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold">Etapas de venta</h2>
          <p className="mt-0.5 text-sm text-white/55">Primero anticipadas, después general y VIP.</p>
        </div>
        <button
          type="button"
          onClick={() => setAyuda((v) => !v)}
          aria-expanded={ayuda}
          className="h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold text-white/75 hover:bg-white/5"
        >
          {ayuda ? "Cerrar ayuda" : "Cómo funciona"}
        </button>
      </div>

      {ayuda && (
        <ul className="mt-4 list-disc space-y-1.5 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] py-3 pl-8 pr-4 text-sm text-sky-100/90">
          <li>Cada fiesta vende por etapas. Lo que está <strong>A la venta</strong> se puede comprar ahora.</li>
          <li>
            <strong>Próximamente</strong> se ve en la página pero no se puede comprar. Con fecha, abre sola ese día; sin
            fecha, la abrís vos con &quot;Abrir venta ahora&quot;.
          </li>
          <li>Cambiar un precio no modifica lo que ya se vendió.</li>
          <li>Cupos, diseño de la entrada y tipos nuevos están en &quot;Entradas y precios&quot;.</li>
        </ul>
      )}

      {fiestaProx && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-400/30 bg-sky-400/[0.07] px-4 py-3 text-sm text-sky-100">
          <span>
            Toda la fiesta está en <strong>Próximamente</strong>: se ve en la página pero nadie puede comprar.
            {evento.ventaAbre ? ` Abre sola el ${ddmm(evento.ventaAbre)} a las ${horaCorta(evento.ventaAbre)}.` : ""}
          </span>
          <button
            type="button"
            onClick={onAbrirFiesta}
            className="h-9 shrink-0 rounded-lg bg-green-600 px-3.5 text-xs font-bold text-white hover:bg-green-500"
          >
            Abrir la venta de esta fiesta
          </button>
        </div>
      )}

      {tipos === null ? (
        <p className="mt-4 text-sm text-white/40">Cargando…</p>
      ) : activos.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-white/55">
          Esta fiesta no tiene entradas activas.{" "}
          <button type="button" onClick={onVerTodo} className="font-semibold text-oro underline">
            Crear una
          </button>
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activos.map((t) => {
            const color = getEstiloEntrada({ estilo: t.estilo, colorEvento: evento.colorPrimario, colorAcento: t.colorAcento }).acento;
            // Estado propio del tipo, sin contar que la fiesta entera esté en Próximamente.
            const sinAbrir = tipoEnProximamente(t);
            const esperaFiesta = fiestaProx && !sinAbrir;
            const chip = esperaFiesta
              ? { texto: "Lista para vender", clase: "bg-white/10 text-white/70" }
              : t.fase === "venta"
                ? { texto: "A la venta", clase: "bg-green-500/15 text-green-300" }
                : t.fase === "proximamente"
                  ? { texto: "Próximamente", clase: "bg-sky-500/15 text-sky-200" }
                  : { texto: t.motivo ?? "Cerrada", clase: "bg-amber-500/15 text-amber-200" };
            const detalle = esperaFiesta
              ? `Se vende cuando abras la fiesta · precio ${t.mostrarPrecioPrevio ? "visible" : "oculto"}`
              : t.fase === "venta"
                ? t.ventaHasta
                  ? `Se vende hasta el ${ddmm(t.ventaHasta)}`
                  : "Se vende hasta el día de la fiesta"
                : t.fase === "proximamente"
                  ? `${t.ventaDesde ? `Abre sola el ${ddmm(t.ventaDesde)} a las ${horaCorta(t.ventaDesde)}` : "Fecha a confirmar"} · precio ${t.mostrarPrecioPrevio ? "visible" : "oculto"}`
                  : t.fase === "agotada"
                    ? "No quedan entradas"
                    : "";
            return (
              <div key={t.id} className="flex flex-col rounded-2xl border p-4" style={{ borderColor: `${color}55`, backgroundColor: `${color}0d` }}>
                <Chip {...chip} />
                <p className="mt-2 font-display text-sm font-bold" style={{ color }}>
                  {t.nombre}
                </p>
                <p className="font-display text-2xl font-extrabold">{formatPrecio(t.precio)}</p>
                <p className="mt-0.5 text-xs text-white/60">
                  {t.vendidas} {t.vendidas === 1 ? "vendida" : "vendidas"}
                  {t.cupo !== null ? ` de ${t.cupo}` : ""}
                </p>
                {detalle && <p className="mt-0.5 text-xs text-white/60">{detalle}</p>}
                <div className="mt-3 flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => abrirEditor(t)}
                    className="h-9 rounded-lg border border-white/20 text-xs font-semibold hover:bg-white/5 disabled:opacity-50"
                  >
                    {sinAbrir ? "Cambiar precio o fecha" : "Cambiar precio"}
                  </button>
                  {sinAbrir && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() =>
                        confirm(`¿Abrir ahora la venta de ${t.nombre} a ${formatPrecio(t.precio)}${alcance}?`) &&
                        aplicar(t, { proximamente: false, ventaDesde: null }, `${t.nombre} a la venta`)
                      }
                      className="h-9 rounded-lg border border-green-500/50 bg-green-500/10 text-xs font-semibold text-green-300 hover:bg-green-500/20 disabled:opacity-50"
                    >
                      Abrir venta ahora
                    </button>
                  )}
                  {t.fase === "venta" && !esperaFiesta && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => {
                        const quedaOtra = activos.some((x) => x.id !== t.id && x.comprable);
                        if (!confirm(`¿Cerrar ahora la venta de ${t.nombre}${alcance}? Lo ya vendido sigue valiendo.`)) return;
                        aplicar(
                          t,
                          { ventaHasta: new Date().toISOString() },
                          quedaOtra ? `${t.nombre} cerrada` : `${t.nombre} cerrada. No queda nada a la venta: abrí la etapa siguiente`
                        );
                      }}
                      className="h-9 rounded-lg border border-white/15 text-xs font-semibold text-white/70 hover:bg-white/5 disabled:opacity-50"
                    >
                      Cerrar venta ahora
                    </button>
                  )}
                  {t.fase === "cerrada" && t.ventaHasta && evento.estado !== "finalizado" && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() =>
                        confirm(`¿Volver a vender ${t.nombre}${alcance} hasta el día de la fiesta?`) &&
                        aplicar(t, { ventaHasta: null }, `${t.nombre} a la venta de nuevo`)
                      }
                      className="h-9 rounded-lg border border-white/15 text-xs font-semibold text-white/70 hover:bg-white/5 disabled:opacity-50"
                    >
                      Volver a vender
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {otras > 0 ? (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/75">
            <input type="checkbox" checked={enTodas} onChange={(e) => setEnTodas(e.target.checked)} className="h-4 w-4 accent-[#d4a853]" />
            Aplicar los cambios a las {totalFiestas} fiestas
          </label>
        ) : (
          <span />
        )}
        <button type="button" onClick={onVerTodo} className="text-xs font-semibold text-oro underline">
          Más opciones{ocultos > 0 ? ` (${ocultos} ${ocultos === 1 ? "desactivada" : "desactivadas"})` : ""}
        </button>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={() => setEditor(null)}>
          <form
            onSubmit={guardarEditor}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Cambiar ${editor.tipo.nombre}`}
            className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl border border-white/10 bg-[#0e0e14] p-5 sm:rounded-3xl"
          >
            <h3 className="font-display text-lg font-extrabold">{editor.tipo.nombre}</h3>
            <label className="flex flex-col gap-1 text-xs text-white/60">
              Precio ($)
              <input
                required
                type="number"
                min={1}
                inputMode="numeric"
                value={editor.precio}
                onChange={(e) => setEditor({ ...editor, precio: e.target.value })}
                className="campo"
                autoFocus
              />
            </label>
            {editor.apertura && (
              <>
                <label className="flex flex-col gap-1 text-xs text-white/60">
                  Cuándo abre la venta
                  <select
                    value={editor.apertura}
                    onChange={(e) => setEditor({ ...editor, apertura: e.target.value as Apertura })}
                    className="campo"
                  >
                    <option value="confirmar">Todavía no sé (la abro yo)</option>
                    <option value="fecha">En una fecha (abre sola)</option>
                  </select>
                </label>
                {editor.apertura === "fecha" && (
                  <label className="flex flex-col gap-1 text-xs text-white/60">
                    Día y hora
                    <input
                      type="datetime-local"
                      value={editor.ventaDesde}
                      onChange={(e) => setEditor({ ...editor, ventaDesde: e.target.value })}
                      className="campo [color-scheme:dark]"
                    />
                  </label>
                )}
              </>
            )}
            {editor.opcionPrecio && (
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={editor.mostrarPrecio}
                  onChange={(e) => setEditor({ ...editor, mostrarPrecio: e.target.checked })}
                  className="h-4 w-4 accent-[#d4a853]"
                />
                Mostrar el precio en la página antes de abrir
              </label>
            )}
            {otras > 0 && (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 px-3.5 py-3 text-sm text-white/80">
                <input type="checkbox" checked={enTodas} onChange={(e) => setEnTodas(e.target.checked)} className="h-4 w-4 accent-[#d4a853]" />
                Aplicar también a las otras {otras} fiestas
              </label>
            )}
            <p className="text-xs text-white/45">Las compras ya hechas mantienen el precio que pagaron.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditor(null)} className="h-12 flex-1 rounded-full border border-white/15 text-sm">
                Cancelar
              </button>
              <button type="submit" disabled={ocupado} className="btn-oro h-12 flex-1 text-sm">
                {ocupado ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
