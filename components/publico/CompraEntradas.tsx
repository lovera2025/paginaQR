"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Evento, PaymentMethod, TipoEntradaDisponible } from "@/types";
import { ddmm, formatPrecio, sugerirEmail, whatsappHref } from "@/lib/utils";
import { CuentaTexto } from "./Countdown";
import { IconCorona, IconWhatsapp } from "./iconos";

/** Tarjeta de un tipo que todavía no está a la venta: sin radio, sin cantidad y sin precio (salvo que el admin lo muestre). */
function TipoProximo({ tipo, ocultarFecha }: { tipo: TipoEntradaDisponible; ocultarFecha: boolean }) {
  const vip = tipo.estilo === "vip";
  return (
    <div
      className="relative flex items-center gap-3.5 overflow-hidden rounded-[18px] border-2 border-dashed border-white/12 bg-white/[0.025] p-4"
      aria-label={`${tipo.nombre}: próximamente`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-display text-[9px] font-extrabold tracking-[0.16em] text-white/80">
          {vip && <IconCorona size={9} />}
          PRÓXIMAMENTE
        </span>
        <span className={`font-display text-base font-extrabold ${vip ? "text-oro-claro/80" : "text-white/85"}`}>{tipo.nombre}</span>
        {tipo.descripcion && <span className="text-xs leading-snug text-white/55">{tipo.descripcion}</span>}
        {tipo.beneficios.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {tipo.beneficios.map((b) => (
              <span key={b} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/65">
                {b}
              </span>
            ))}
          </span>
        )}
        {!ocultarFecha && (
          <span className="text-xs font-semibold text-white/70">
            {tipo.abreEl ? <CuentaTexto fecha={tipo.abreEl} recargarAlTerminar /> : "Fecha a confirmar"}
          </span>
        )}
      </span>
      {tipo.mostrarPrecioPrevio && tipo.precio > 0 && (
        <span className="shrink-0 font-display text-lg font-extrabold text-white/60">{formatPrecio(tipo.precio)}</span>
      )}
    </div>
  );
}

function TipoOpcion({
  tipo,
  seleccionado,
  onSelect,
  precioGeneral,
}: {
  tipo: TipoEntradaDisponible;
  seleccionado: boolean;
  onSelect: () => void;
  precioGeneral: number | null;
}) {
  const disabled = !tipo.comprable;
  const vip = tipo.estilo === "vip";
  const anticipada = tipo.estilo === "anticipada";
  const color = vip ? "#d4a853" : anticipada ? "#e0953c" : tipo.estilo === "custom" && tipo.colorAcento ? tipo.colorAcento : "#d4a853";

  let estado: string;
  if (disabled) estado = tipo.motivo ?? "No disponible";
  else if (tipo.disponibles <= 15) estado = `¡Quedan ${tipo.disponibles}!`;
  else if (anticipada && tipo.ventaHasta) estado = `Hasta el ${ddmm(tipo.ventaHasta)}`;
  else if (tipo.cupo !== null) estado = `Quedan ${tipo.disponibles}`;
  else estado = "Disponible";

  return (
    <label
      className={`relative flex cursor-pointer items-center gap-3.5 overflow-hidden rounded-[18px] border-2 p-4 pl-3.5 transition ${
        disabled ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] opacity-55" : ""
      } ${vip && !disabled ? "vip-foil animate-shine" : ""}`}
      style={
        disabled
          ? undefined
          : {
              borderColor: seleccionado ? color : vip ? "rgba(212,168,83,0.55)" : "rgba(255,255,255,0.12)",
              backgroundColor: vip ? undefined : seleccionado ? `${color}1a` : "rgba(255,255,255,0.04)",
              boxShadow: seleccionado ? `0 0 0 4px ${color}22` : undefined,
            }
      }
    >
      {anticipada && !disabled && (
        <span
          aria-hidden
          className="absolute -right-9 top-3.5 w-36 rotate-45 bg-naranja py-1 text-center font-display text-[9px] font-extrabold tracking-[0.14em] text-tinta"
        >
          ANTICIPADA
        </span>
      )}
      {vip && (
        <span
          aria-hidden
          className="absolute right-3.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-oro px-2 py-1 font-display text-[9px] font-extrabold tracking-[0.14em] text-tinta"
        >
          <IconCorona size={10} />
          VIP
        </span>
      )}
      <input
        type="radio"
        name="tipo"
        aria-label={`${tipo.nombre} ${formatPrecio(tipo.precio)}${disabled ? ` (${tipo.motivo ?? "no disponible"})` : ""}`}
        checked={seleccionado}
        disabled={disabled}
        onChange={onSelect}
        className="h-[22px] w-[22px] shrink-0"
        style={{ accentColor: color }}
      />
      <span className={`flex min-w-0 flex-1 flex-col gap-1 ${vip ? "pt-3" : ""}`}>
        <span className={`font-display text-base font-extrabold ${vip ? "text-oro-claro" : "text-white"}`}>
          {tipo.nombre}
        </span>
        {tipo.descripcion && <span className="text-xs leading-snug text-white/70">{tipo.descripcion}</span>}
        {tipo.beneficios.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {tipo.beneficios.map((b) => (
              <span key={b} className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-white/80">
                {b}
              </span>
            ))}
          </span>
        )}
        <span
          className="text-xs font-semibold"
          style={{ color: disabled ? "rgba(255,255,255,0.6)" : tipo.disponibles <= 15 ? "#fbbf24" : anticipada ? "#f0b56a" : vip ? "#f0d389" : "#7ed49a" }}
        >
          {estado}
        </span>
      </span>
      <span className={`flex shrink-0 flex-col items-end gap-0.5 ${anticipada && !disabled ? "pr-6" : ""} ${vip ? "pt-3" : ""}`}>
        {anticipada && precioGeneral !== null && precioGeneral > tipo.precio && (
          <span className="text-xs text-white/45 line-through">{formatPrecio(precioGeneral)}</span>
        )}
        <span
          className="font-display text-xl font-extrabold"
          style={{ color: disabled ? "rgba(255,255,255,0.6)" : vip ? "#f0d389" : anticipada ? "#f0b56a" : "#ffffff" }}
        >
          {formatPrecio(tipo.precio)}
        </span>
      </span>
    </label>
  );
}

export function CompraEntradas({
  evento,
  tipos,
  whatsapp = "",
  fiestaProximamente = false,
  medios = [],
}: {
  evento: Evento;
  tipos: TipoEntradaDisponible[];
  whatsapp?: string;
  /** Toda la fiesta en próximamente: la fecha de apertura se muestra arriba, no en cada tipo. */
  fiestaProximamente?: boolean;
  /** Medios de pago activos (para no prometer uno que no está). */
  medios?: PaymentMethod[];
}) {
  const router = useRouter();
  const visibles = tipos.filter((t) => t.activo);
  const primero = visibles.find((t) => t.comprable) ?? null;
  const hayProximos = visibles.some((t) => t.fase === "proximamente");
  const waAvisame = whatsappHref(whatsapp, `Hola! Avisame cuando abra la venta de ${evento.nombre}`);
  const [tipoId, setTipoId] = useState<string | null>(primero?.id ?? null);
  const [cantidad, setCantidad] = useState(1);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  // Aviso de mail mal escrito: se muestra al salir del campo (o al intentar seguir) y hasta que elija.
  const [emailTocado, setEmailTocado] = useState(false);
  const [emailConfirmado, setEmailConfirmado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const avisoEmailRef = useRef<HTMLDivElement>(null);
  const sugerencia = emailConfirmado === email.trim() ? null : sugerirEmail(email);

  const tipo = visibles.find((t) => t.id === tipoId) ?? null;
  const max = tipo ? Math.max(1, Math.min(10, tipo.disponibles)) : 10;
  const precioGeneral = useMemo(() => {
    const general = visibles.find((t) => t.estilo === "general" && t.activo);
    // Solo se tacha contra la General si su precio es público.
    if (!general || (general.fase === "proximamente" && !general.mostrarPrecioPrevio)) return null;
    return general.precio;
  }, [visibles]);

  useEffect(() => {
    if (cantidad > max) setCantidad(max);
  }, [max, cantidad]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) {
      setError("Elegí un tipo de entrada");
      return;
    }
    if (sugerencia) {
      // Antes de crear la compra: que confirme el mail (si está mal, no lo podemos contactar).
      setEmailTocado(true);
      avisoEmailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventoId: evento.id,
          tipoEntradaId: tipo.id,
          cantidad,
          compradorNombre: nombre,
          compradorEmail: email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No pudimos crear tu compra");
        setLoading(false);
        return;
      }
      router.push(`/comprar/pago?orden=${data.ordenId}`);
    } catch {
      setError("Sin conexión. Probá de nuevo.");
      setLoading(false);
    }
  }

  if (visibles.length === 0) {
    return (
      <div className="tarjeta p-6 text-center text-sm text-white/60">
        Las entradas para esta fiesta salen a la venta muy pronto.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Tipo de entrada">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[22px] font-extrabold">
            {primero ? (
              <>
                Elegí tu <span className="text-oro">entrada</span>
              </>
            ) : (
              <>
                Las <span className="text-oro">entradas</span>
              </>
            )}
          </h2>
          {primero && <span className="text-xs text-white/55">1 tipo por compra</span>}
        </div>
        {visibles.map((t) =>
          t.fase === "proximamente" ? (
            <TipoProximo key={t.id} tipo={t} ocultarFecha={fiestaProximamente} />
          ) : (
            <TipoOpcion
              key={t.id}
              tipo={t}
              seleccionado={t.id === tipoId}
              onSelect={() => {
                setTipoId(t.id);
                setError("");
              }}
              precioGeneral={precioGeneral}
            />
          )
        )}
      </div>

      {primero ? (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="tarjeta flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold">Cantidad</span>
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                aria-label="Una entrada menos"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                disabled={cantidad <= 1}
                className="h-11 w-11 rounded-full border border-white/20 text-2xl leading-none text-white transition hover:border-white/40 disabled:opacity-30"
              >
                −
              </button>
              <span className="min-w-[24px] text-center font-display text-[22px] font-extrabold tabular-nums" aria-live="polite">
                {cantidad}
              </span>
              <button
                type="button"
                aria-label="Una entrada más"
                onClick={() => setCantidad((c) => Math.min(max, c + 1))}
                disabled={cantidad >= max}
                className="h-11 w-11 rounded-full bg-oro text-2xl leading-none text-tinta transition hover:brightness-110 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nombre" className="text-xs font-semibold text-white/65">
              Nombre y apellido
            </label>
            <input
              id="nombre"
              required
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="campo"
              placeholder="Como figura en tu DNI"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-white/65">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailTocado(true)}
              className="campo"
              placeholder="tu@email.com"
              aria-describedby={sugerencia && emailTocado ? "email-sugerencia" : undefined}
            />
            {sugerencia && emailTocado ? (
              <div
                ref={avisoEmailRef}
                id="email-sugerencia"
                role="alert"
                className="flex flex-col gap-2.5 rounded-xl border border-oro/40 bg-oro/[0.08] px-3.5 py-3"
              >
                <p className="text-sm text-white/85">
                  ¿Quisiste decir <strong className="break-all text-oro-claro">{sugerencia}</strong>?
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(sugerencia);
                      setEmailConfirmado(sugerencia);
                    }}
                    className="min-h-[40px] rounded-full bg-oro px-4 text-sm font-semibold text-tinta transition hover:brightness-110"
                  >
                    Sí, corregir
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailConfirmado(email.trim())}
                    className="min-h-[40px] rounded-full border border-white/25 px-4 text-sm text-white/80 transition hover:border-white/45"
                  >
                    No, está bien así
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/55">Solo para contactarte si hay algún problema con tu compra. Las entradas te aparecen en pantalla.</p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {tipo && (
              <motion.div
                key={`${tipo.id}-${cantidad}`}
                initial={{ opacity: 0.4, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-2 rounded-2xl border border-oro/35 bg-oro/[0.08] p-4"
              >
                <div className="flex justify-between text-[13px] text-white/70">
                  <span>
                    {cantidad} × {tipo.nombre}
                  </span>
                  <span>{formatPrecio(tipo.precio * cantidad)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="font-display text-[26px] font-extrabold text-oro-claro">
                    {formatPrecio(tipo.precio * cantidad)}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading || !tipo?.comprable} className="btn-oro h-[58px] text-base">
            {loading ? "Procesando…" : "Continuar al pago →"}
          </button>
          {(medios.includes("mp") || medios.includes("talo")) && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/60">
              {medios.includes("mp") && (
                <span className="rounded-md bg-[#009ee3] px-2 py-1 text-[11px] font-bold text-white">Mercado Pago</span>
              )}
              {medios.includes("mp") && medios.includes("talo") && <span>o</span>}
              {medios.includes("talo") && (
                <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold text-white">Transferencia</span>
              )}
              <span>{medios.length > 1 ? "· elegís en el próximo paso" : "· pago seguro"}</span>
            </div>
          )}
        </form>
      ) : hayProximos ? (
        <div className="tarjeta flex flex-col items-center gap-3 p-5 text-center">
          <p className="font-display text-lg font-extrabold">Todavía no abrió la venta</p>
          <p className="text-sm text-white/60">
            {waAvisame
              ? "Las entradas salen muy pronto. Te avisamos por WhatsApp."
              : "Las entradas salen muy pronto. Volvé a entrar en unos días para comprar la tuya."}
          </p>
          {waAvisame && (
            <a
              href={waAvisame}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#25d366] px-5 text-sm font-bold text-[#06240f]"
            >
              <IconWhatsapp size={18} />
              Avisame cuando abra
            </a>
          )}
        </div>
      ) : (
        <div className="tarjeta p-5 text-center text-sm text-white/65">
          No hay entradas disponibles en este momento.{whatsapp ? " Consultá por WhatsApp." : ""}
        </div>
      )}
    </div>
  );
}

/** Barra fija abajo en el celular mientras el formulario no está a la vista. */
export function StickyCta({ precioDesde, targetId }: { precioDesde: number | null; targetId: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [targetId]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-oro/30 bg-noche/90 px-5 pt-3 backdrop-blur-md lg:hidden"
        >
          <div className="flex flex-col">
            <span className="text-xs text-white/60">Desde</span>
            <span className="font-display text-lg font-extrabold text-oro-claro">
              {precioDesde !== null ? formatPrecio(precioDesde) : "—"}
            </span>
          </div>
          <a href={`#${targetId}`} className="btn-oro h-[50px] px-7 text-sm">
            Comprar entradas
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
