"use client";

import { useEffect, useMemo, useState } from "react";
import { MOTIVOS_ANULACION } from "@/lib/entradas/anulaciones";
import { formatPrecio, horaCorta } from "@/lib/utils";
import type { Orden, Ticket } from "@/types";

const OTRO = "__otro__";

/** Anular entradas de una compra a mano (el comprador avisó por WhatsApp). */
export function AnularModal({
  ordenId,
  onClose,
  onDone,
}: {
  ordenId: string;
  onClose: () => void;
  onDone: (mensaje: string) => void;
}) {
  const [orden, setOrden] = useState<Orden | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_ANULACION[0]);
  const [motivoOtro, setMotivoOtro] = useState("");
  const [devolverPlata, setDevolverPlata] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/ordenes/${ordenId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setOrden(d.orden);
        setTickets(d.tickets ?? []);
      })
      .catch(() => setError("No se pudo cargar la compra"))
      .finally(() => setCargando(false));
  }, [ordenId]);

  const anulables = useMemo(() => tickets.filter((t) => !t.cancelado && !t.usado), [tickets]);
  const monto = orden ? elegidas.length * orden.precioUnitario : 0;
  const motivoFinal = motivo === OTRO ? motivoOtro.trim() : motivo;

  function toggle(id: string) {
    setError("");
    setElegidas((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  }

  async function confirmar() {
    if (elegidas.length === 0) return setError("Elegí al menos una entrada");
    if (!motivoFinal) return setError("Escribí el motivo");
    const accion = devolverPlata
      ? `¿Anular ${elegidas.length} ${elegidas.length === 1 ? "entrada" : "entradas"} y registrar que devolviste ${formatPrecio(monto)}? Los QR dejan de valer en la puerta.`
      : `¿Anular ${elegidas.length} ${elegidas.length === 1 ? "entrada" : "entradas"} SIN devolver plata? Los QR dejan de valer en la puerta.`;
    if (!confirm(accion)) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/ordenes/${ordenId}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds: elegidas, motivo: motivoFinal, devolverPlata }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo anular");
        return;
      }
      onDone(
        `${data.tickets.length} ${data.tickets.length === 1 ? "entrada anulada" : "entradas anuladas"}${
          data.monto > 0 ? ` · devuelto ${formatPrecio(data.monto)}` : ""
        }`
      );
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="anular-titulo">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-[#12121a] p-5 sm:rounded-2xl sm:p-6">
        <h2 id="anular-titulo" className="text-lg font-bold">
          Anular entradas
        </h2>
        {cargando && <p className="mt-4 text-sm text-white/50">Cargando compra…</p>}

        {orden && (
          <>
            <p className="mt-1 text-sm text-white/60">
              {orden.compradorNombre} · {orden.cantidad} × {orden.tipoNombre} · pagó {formatPrecio(orden.montoTotal)}
              {orden.paymentMethod === "mp" ? " con Mercado Pago" : orden.paymentMethod === "talo" ? " por transferencia" : ""}
            </p>
            {orden.montoReembolsado > 0 && (
              <p className="mt-1 text-xs text-amber-300">Ya devuelto: {formatPrecio(orden.montoReembolsado)}</p>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-[0.12em] text-white/45">ENTRADAS</p>
              {anulables.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-oro underline"
                  onClick={() =>
                    setElegidas((xs) => (xs.length === anulables.length ? [] : anulables.map((t) => t.id)))
                  }
                >
                  {elegidas.length === anulables.length ? "Ninguna" : "Todas"}
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {tickets.map((t) => {
                const bloqueada = t.cancelado || t.usado;
                const nota = t.usado
                  ? `ya ingresó${t.usadoAt ? ` ${horaCorta(t.usadoAt)}` : ""}`
                  : t.cancelado
                    ? "ya anulada"
                    : "";
                return (
                  <label
                    key={t.id}
                    className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                      bloqueada ? "border-white/5 text-white/35" : "cursor-pointer border-white/12 hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-red-500"
                      disabled={bloqueada}
                      checked={elegidas.includes(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                    <span className="flex-1">
                      Entrada {t.numeroEntrada} de {t.totalEntradas}
                    </span>
                    {nota && <span className="text-xs">{nota}</span>}
                  </label>
                );
              })}
            </div>

            <label className="mt-4 block text-xs font-semibold tracking-[0.12em] text-white/45" htmlFor="anular-motivo">
              MOTIVO
            </label>
            <select
              id="anular-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none"
            >
              {MOTIVOS_ANULACION.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={OTRO}>Otro…</option>
            </select>
            {motivo === OTRO && (
              <input
                value={motivoOtro}
                onChange={(e) => setMotivoOtro(e.target.value)}
                maxLength={120}
                placeholder="Contá brevemente qué pasó"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none"
              />
            )}

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <input
                type="checkbox"
                checked={devolverPlata}
                onChange={(e) => setDevolverPlata(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-green-500"
              />
              <span className="text-sm">
                Ya le devolví la plata
                <span className="mt-0.5 block text-xs text-white/50">
                  La devolución la hacés vos (transferencia o desde Mercado Pago). Acá solo queda registrada. Sin marcar, es
                  una baja sin devolución.
                </span>
              </span>
            </label>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm">
              <span className="text-white/60">{devolverPlata ? "A registrar como devuelto" : "Sin devolución"}</span>
              <strong>{devolverPlata ? formatPrecio(monto) : "—"}</strong>
            </div>
          </>
        )}

        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-white/10 text-sm">
            Cancelar
          </button>
          {orden && (
            <button
              type="button"
              onClick={confirmar}
              disabled={enviando || elegidas.length === 0}
              className="h-12 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-40"
            >
              {enviando
                ? "Anulando…"
                : `Anular ${elegidas.length || ""} ${elegidas.length === 1 ? "entrada" : "entradas"}`.replace("  ", " ")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
