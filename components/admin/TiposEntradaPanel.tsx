"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EntradaCard } from "@/components/entradas/EntradaCard";
import { IconQr } from "@/components/publico/iconos";
import { ESTILO_LABELS, getEstiloEntrada } from "@/lib/entradas/estilos";
import { TIPO_PRESETS } from "@/lib/entradas/tipos";
import { ddmm, formatPrecio, isoToDatetimeLocalAr } from "@/lib/utils";
import type { EntradaEstilo, Evento, StatsPorTipo, TipoEntradaDisponible } from "@/types";

type EstadoVenta = "venta" | "fecha" | "confirmar";

interface Form {
  id?: string;
  nombre: string;
  precio: string;
  cupo: string;
  estadoVenta: EstadoVenta;
  mostrarPrecioPrevio: boolean;
  ventaDesde: string; // datetime-local AR (solo en "fecha")
  ventaHasta: string;
  estilo: EntradaEstilo;
  colorAcento: string;
  descripcion: string;
  beneficios: string;
  activo: boolean;
  vendidas: number;
}

const ESTILOS: EntradaEstilo[] = ["anticipada", "general", "vip", "custom"];

function aIso(local: string): string | null {
  return local ? `${local}:00-03:00` : null;
}

function formDesde(t: TipoEntradaDisponible): Form {
  return {
    id: t.id,
    nombre: t.nombre,
    precio: String(t.precio),
    cupo: t.cupo === null ? "" : String(t.cupo),
    estadoVenta: t.ventaDesde ? "fecha" : t.proximamente ? "confirmar" : "venta",
    mostrarPrecioPrevio: t.mostrarPrecioPrevio,
    ventaDesde: t.ventaDesde ? isoToDatetimeLocalAr(t.ventaDesde) : "",
    ventaHasta: t.ventaHasta ? isoToDatetimeLocalAr(t.ventaHasta) : "",
    estilo: t.estilo,
    colorAcento: t.colorAcento || "#ff006e",
    descripcion: t.descripcion,
    beneficios: t.beneficios.join("\n"),
    activo: t.activo,
    vendidas: t.vendidas,
  };
}

function formNuevo(preset: keyof typeof TIPO_PRESETS | "otro", evento: Evento): Form {
  const base =
    preset === "otro"
      ? { ...TIPO_PRESETS.general, nombre: "", estilo: "custom" as EntradaEstilo, descripcion: "" }
      : TIPO_PRESETS[preset];
  let ventaHasta = "";
  if (preset === "anticipada") {
    const d = new Date(evento.fecha);
    d.setDate(d.getDate() - 7);
    ventaHasta = `${isoToDatetimeLocalAr(d.toISOString()).slice(0, 10)}T23:59`;
  }
  return {
    nombre: base.nombre,
    precio: "",
    cupo: base.cupo === null ? "" : String(base.cupo),
    estadoVenta: preset !== "otro" && base.proximamente ? "confirmar" : "venta",
    mostrarPrecioPrevio: false,
    ventaDesde: "",
    ventaHasta,
    estilo: base.estilo,
    colorAcento: "#ff006e",
    descripcion: base.descripcion,
    beneficios: base.beneficios.join("\n"),
    activo: true,
    vendidas: 0,
  };
}

function Swatch({ estilo, evento, color }: { estilo: EntradaEstilo; evento: Evento; color?: string }) {
  const e = getEstiloEntrada({ estilo, colorEvento: evento.colorPrimario, fondoEvento: evento.colorSecundario, colorAcento: color });
  return (
    <span
      className={`inline-block h-6 w-9 shrink-0 rounded-md ${estilo === "vip" ? "vip-foil" : ""}`}
      style={{ backgroundColor: estilo === "vip" ? undefined : e.fondo, border: `2px solid ${e.acento}` }}
    />
  );
}

export function TiposEntradaPanel({
  evento,
  porTipo,
  onToast,
  onChanged,
}: {
  evento: Evento;
  porTipo: StatsPorTipo[];
  onToast: (type: "success" | "error", text: string) => void;
  onChanged: () => void;
}) {
  const [tipos, setTipos] = useState<TipoEntradaDisponible[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/admin/tipos?evento=${evento.id}`, { cache: "no-store" });
    const d = await r.json();
    setTipos(d.tipos ?? []);
  }, [evento.id]);

  useEffect(() => {
    setTipos(null);
    setForm(null);
    cargar();
  }, [cargar]);

  const recaudadoPorTipo = useMemo(() => new Map(porTipo.map((p) => [p.tipoEntradaId, p.recaudado])), [porTipo]);
  const sumaCupos = (tipos ?? []).filter((t) => t.activo && t.cupo !== null).reduce((s, t) => s + (t.cupo ?? 0), 0);
  const hayAbiertos = (tipos ?? []).some((t) => t.activo && t.cupo === null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError("");
    if (form.estadoVenta === "fecha" && !form.ventaDesde) {
      setError("Elegí la fecha y hora en que abre la venta");
      return;
    }
    setGuardando(true);
    const body = {
      eventoId: evento.id,
      nombre: form.nombre,
      precio: Number(form.precio),
      cupo: form.cupo.trim() === "" ? null : Number(form.cupo),
      proximamente: form.estadoVenta !== "venta",
      mostrarPrecioPrevio: form.estadoVenta !== "venta" && form.mostrarPrecioPrevio,
      ventaDesde: form.estadoVenta === "fecha" ? aIso(form.ventaDesde) : null,
      ventaHasta: aIso(form.ventaHasta),
      estilo: form.estilo,
      colorAcento: form.estilo === "custom" ? form.colorAcento : "",
      descripcion: form.descripcion,
      beneficios: form.beneficios,
      activo: form.activo,
    };
    try {
      const res = await fetch(form.id ? `/api/admin/tipos/${form.id}` : "/api/admin/tipos", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      onToast("success", form.id ? `${form.nombre} actualizada` : `${form.nombre} creada`);
      setForm(null);
      await cargar();
      onChanged();
    } finally {
      setGuardando(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    const res = await fetch(`/api/admin/tipos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      onToast("error", data.error ?? "No se pudo actualizar");
      return;
    }
    onToast("success", ok);
    await cargar();
    onChanged();
  }

  async function borrar(t: TipoEntradaDisponible) {
    if (!confirm(`¿Borrar el tipo "${t.nombre}"?`)) return;
    const res = await fetch(`/api/admin/tipos/${t.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      onToast("error", data.error ?? "No se pudo borrar");
      return;
    }
    onToast("success", `${t.nombre} borrada`);
    setForm(null);
    await cargar();
    onChanged();
  }

  async function mover(idx: number, dir: -1 | 1) {
    if (!tipos) return;
    const ids = tipos.map((t) => t.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await fetch("/api/admin/tipos/reordenar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId: evento.id, ids }),
    });
    await cargar();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Entradas y precios</h2>
          <p className="mt-1 max-w-xl text-sm text-white/55">
            Cada tipo tiene su precio, cupo, fechas de venta y diseño. Si cambiás un precio, las compras ya hechas
            mantienen el precio que pagaron.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setForm(formNuevo("anticipada", evento))} className="h-10 rounded-xl border border-naranja/60 bg-naranja/10 px-3.5 text-sm font-semibold text-[#f0b56a]">
            + Anticipada
          </button>
          <button type="button" onClick={() => setForm(formNuevo("general", evento))} className="h-10 rounded-xl border border-white/20 bg-white/5 px-3.5 text-sm font-semibold">
            + General
          </button>
          <button type="button" onClick={() => setForm(formNuevo("vip", evento))} className="h-10 rounded-xl border border-oro/60 bg-oro/15 px-3.5 text-sm font-semibold text-oro-claro">
            + VIP
          </button>
          <button type="button" onClick={() => setForm(formNuevo("otro", evento))} className="h-10 rounded-xl border border-dashed border-white/25 px-3.5 text-sm font-semibold text-white/70">
            + Otro
          </button>
        </div>
      </div>

      {tipos === null ? (
        <p className="text-white/40">Cargando…</p>
      ) : tipos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/55">
          Esta fiesta todavía no tiene tipos de entrada. Creá al menos uno para poder vender.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-[11px] tracking-[0.1em] text-white/50">
              <tr>
                <th className="px-4 py-3 font-semibold">ORDEN</th>
                <th className="px-4 py-3 font-semibold">TIPO · DISEÑO</th>
                <th className="px-4 py-3 font-semibold">PRECIO</th>
                <th className="px-4 py-3 font-semibold">VENDIDAS / CUPO</th>
                <th className="px-4 py-3 font-semibold">RECAUDADO</th>
                <th className="px-4 py-3 font-semibold">VENTA</th>
                <th className="px-4 py-3 font-semibold">ESTADO</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tipos.map((t, i) => {
                const pct = t.cupo ? Math.min(100, (t.vendidas / t.cupo) * 100) : evento.capacidad ? Math.min(100, (t.vendidas / evento.capacidad) * 100) : 0;
                const color = getEstiloEntrada({ estilo: t.estilo, colorEvento: evento.colorPrimario, colorAcento: t.colorAcento }).acento;
                const anticipadaAbierta = t.estilo === "anticipada" && t.comprable;
                return (
                  <tr key={t.id} className={`border-t border-white/[0.07] ${form?.id === t.id ? "bg-oro/[0.06]" : ""}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1">
                        <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="h-7 w-7 rounded-lg border border-white/15 text-white/60 disabled:opacity-25">
                          ↑
                        </button>
                        <button type="button" aria-label="Bajar" disabled={i === tipos.length - 1} onClick={() => mover(i, 1)} className="h-7 w-7 rounded-lg border border-white/15 text-white/60 disabled:opacity-25">
                          ↓
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Swatch estilo={t.estilo} evento={evento} color={t.colorAcento} />
                        <div className="flex flex-col">
                          <span className={`font-display text-sm font-bold ${t.estilo === "vip" ? "text-oro-claro" : ""}`}>{t.nombre}</span>
                          <span className="text-[11px] text-white/45">{ESTILO_LABELS[t.estilo]}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-display text-[15px] font-bold">{formatPrecio(t.precio)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex min-w-[130px] flex-col gap-1.5">
                        <span>
                          {t.vendidas} / {t.cupo ?? "sin tope"}
                        </span>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-white/80">{formatPrecio(recaudadoPorTipo.get(t.id) ?? 0)}</td>
                    <td className="px-4 py-3.5 text-xs text-white/70">
                      {t.ventaDesde ? `Abre ${ddmm(t.ventaDesde)}` : t.proximamente ? "Fecha a confirmar" : "Desde ya"}
                      <br />
                      {t.ventaHasta ? `Hasta ${ddmm(t.ventaHasta)}` : "Hasta el día"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          t.comprable
                            ? "bg-green-500/15 text-green-300"
                            : t.fase === "proximamente"
                              ? "bg-sky-500/15 text-sky-200"
                              : t.activo
                                ? "bg-amber-500/15 text-amber-200"
                                : "bg-white/10 text-white/55"
                        }`}
                      >
                        {t.comprable
                          ? "A la venta"
                          : t.fase === "proximamente"
                            ? `Próximamente · ${t.abreEl ? `abre ${ddmm(t.abreEl)}` : "a confirmar"}`
                            : t.motivo}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <button type="button" onClick={() => setForm(formDesde(t))} className="h-8 rounded-lg border border-white/20 px-3 text-xs font-semibold hover:bg-white/5">
                          Editar
                        </button>
                        {t.activo && t.fase === "proximamente" && !t.abreEl && (
                          <button
                            type="button"
                            onClick={() =>
                              confirm(`¿Abrir la venta de ${t.nombre} ahora a ${formatPrecio(t.precio)}?`) &&
                              patch(t.id, { proximamente: false, ventaDesde: null }, `${t.nombre} a la venta`)
                            }
                            className="text-[11px] text-green-300 hover:underline"
                          >
                            Abrir venta ahora
                          </button>
                        )}
                        {anticipadaAbierta && (
                          <button
                            type="button"
                            onClick={() =>
                              confirm(`¿Cerrar la venta de ${t.nombre} ahora?`) &&
                              patch(t.id, { ventaHasta: new Date().toISOString() }, `${t.nombre} cerrada`)
                            }
                            className="text-[11px] text-[#f0b56a] hover:underline"
                          >
                            Cerrar ahora
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => patch(t.id, { activo: !t.activo }, t.activo ? `${t.nombre} desactivada` : `${t.nombre} activada`)}
                          className="text-[11px] text-white/55 hover:underline"
                        >
                          {t.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-white/45">
        Capacidad total de la fiesta: <strong className="text-white/80">{evento.capacidad}</strong> (se cambia en la pestaña Fiesta).
        Un tipo con cupo tiene su propio tope; los que no tienen cupo comparten lo que queda.
        {!hayAbiertos && sumaCupos > evento.capacidad && (
          <span className="mt-1 block text-amber-300">
            Ojo: la suma de cupos ({sumaCupos}) supera la capacidad. Se va a cortar al llegar a {evento.capacidad}.
          </span>
        )}
      </p>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <div
            className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0e0e14] sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={form.id ? `Editar ${form.nombre}` : "Nuevo tipo de entrada"}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="font-display text-lg font-extrabold">{form.id ? `Editar · ${form.nombre}` : "Nuevo tipo de entrada"}</h3>
              <button type="button" aria-label="Cerrar" onClick={() => setForm(null)} className="h-9 w-9 rounded-full border border-white/15 text-white/70">
                ✕
              </button>
            </div>
            <div className="grid flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-[1fr_340px]">
              <form id="form-tipo" onSubmit={guardar} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 flex flex-col gap-1 text-xs text-white/60">
                    Nombre
                    <input required maxLength={40} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Anticipada 2da tanda" className="campo" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-white/60">
                    Precio ($)
                    <input required type="number" min={1} inputMode="numeric" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} placeholder="15000" className="campo" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-white/60">
                    Cupo (vacío = sin tope)
                    <input type="number" min={1} inputMode="numeric" value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} placeholder="Sin tope" className="campo" />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 text-xs text-white/60">
                    Estado de venta
                    <select
                      value={form.estadoVenta}
                      onChange={(e) => setForm({ ...form, estadoVenta: e.target.value as EstadoVenta })}
                      className="campo"
                    >
                      <option value="venta">A la venta</option>
                      <option value="fecha">Próximamente · abre en una fecha (con cuenta regresiva)</option>
                      <option value="confirmar">Próximamente · fecha a confirmar</option>
                    </select>
                  </label>
                  {form.estadoVenta === "fecha" && (
                    <label className="flex flex-col gap-1 text-xs text-white/60">
                      Abre el
                      <input type="datetime-local" value={form.ventaDesde} onChange={(e) => setForm({ ...form, ventaDesde: e.target.value })} className="campo [color-scheme:dark]" />
                    </label>
                  )}
                  <label className={`flex flex-col gap-1 text-xs text-white/60 ${form.estadoVenta === "fecha" ? "" : "col-span-2 sm:col-span-1"}`}>
                    Venta hasta (vacío = hasta el día)
                    <input type="datetime-local" value={form.ventaHasta} onChange={(e) => setForm({ ...form, ventaHasta: e.target.value })} className="campo [color-scheme:dark]" />
                  </label>
                  {form.estadoVenta !== "venta" && (
                    <div className="col-span-2 flex flex-col gap-2 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] px-4 py-3 text-xs text-sky-100/85">
                      <span>
                        En la página se ve como <strong>PRÓXIMAMENTE</strong>, sin precio ni cantidad.
                        {form.estadoVenta === "fecha"
                          ? " Muestra la cuenta regresiva y abre sola cuando llega la fecha."
                          : " Queda así hasta que la pases a \"A la venta\"."}{" "}
                        El precio lo podés cambiar antes de abrir.
                      </span>
                      <label className="flex items-center gap-2 text-white/80">
                        <input
                          type="checkbox"
                          checked={form.mostrarPrecioPrevio}
                          onChange={(e) => setForm({ ...form, mostrarPrecioPrevio: e.target.checked })}
                          className="h-4 w-4 accent-[#d4a853]"
                        />
                        Mostrar el precio antes de abrir
                      </label>
                    </div>
                  )}
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-xs text-white/60">Diseño de la entrada</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ESTILOS.map((es) => (
                      <button
                        key={es}
                        type="button"
                        onClick={() => setForm({ ...form, estilo: es })}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-2.5 text-[11px] transition ${
                          form.estilo === es ? "border-oro bg-oro/15 font-bold text-oro-claro" : "border-white/12 text-white/65 hover:border-white/30"
                        }`}
                      >
                        <span
                          className={`h-7 w-full rounded-md ${es === "vip" ? "vip-foil" : ""}`}
                          style={{
                            backgroundColor: es === "vip" ? undefined : getEstiloEntrada({ estilo: es, fondoEvento: evento.colorSecundario }).fondo,
                            border: `2px solid ${getEstiloEntrada({ estilo: es, colorEvento: evento.colorPrimario, colorAcento: form.colorAcento }).acento}`,
                          }}
                        />
                        {ESTILO_LABELS[es].split(" (")[0]}
                      </button>
                    ))}
                  </div>
                  {form.estilo === "custom" && (
                    <label className="mt-1 flex items-center gap-3 text-xs text-white/60">
                      Color
                      <input type="color" value={form.colorAcento} onChange={(e) => setForm({ ...form, colorAcento: e.target.value })} className="h-9 w-14 cursor-pointer rounded border border-white/20 bg-transparent" />
                      <span className="font-mono">{form.colorAcento}</span>
                    </label>
                  )}
                </fieldset>

                <label className="flex flex-col gap-1 text-xs text-white/60">
                  Descripción corta
                  <input maxLength={200} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Mismo acceso que la General, a precio promo." className="campo" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-white/60">
                  Beneficios (uno por línea, opcional)
                  <textarea
                    rows={3}
                    value={form.beneficios}
                    onChange={(e) => setForm({ ...form, beneficios: e.target.value })}
                    placeholder={"Sector VIP\nBarra exclusiva"}
                    className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-[15px] text-white outline-none focus:border-oro/70"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 accent-[#d4a853]" />
                  Visible y a la venta
                </label>
                {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
              </form>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-white/45">VISTA PREVIA</span>
                <div className="origin-top scale-[0.9]">
                  <EntradaCard
                    estilo={form.estilo}
                    tipoNombre={form.nombre || "Entrada"}
                    colorAcento={form.estilo === "custom" ? form.colorAcento : undefined}
                    evento={evento}
                    marca={evento.organizadorNombre || "Junior Eventos"}
                    compradorNombre="Juan Pérez"
                    numero={1}
                    total={2}
                    ticketId="9c117b42-0000-0000-0000-000000000000"
                    compacta
                    qr={
                      <div className="flex h-[150px] w-[150px] items-center justify-center text-black/70">
                        <IconQr size={96} />
                      </div>
                    }
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-4">
              <button type="submit" form="form-tipo" disabled={guardando} className="btn-oro h-12 flex-1 px-6 text-sm">
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              {form.id && form.vendidas === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const t = tipos?.find((x) => x.id === form.id);
                    if (t) borrar(t);
                  }}
                  className="h-12 rounded-full border border-red-500/50 px-5 text-sm font-semibold text-red-300"
                >
                  Borrar
                </button>
              )}
              {form.id && form.vendidas > 0 && (
                <p className="w-full text-[11px] text-white/45">
                  Tiene {form.vendidas} entradas vendidas: no se puede borrar (sí desactivar). Las entradas emitidas conservan su
                  diseño y precio.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
