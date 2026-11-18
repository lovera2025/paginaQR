"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { guardarCompra, leerComprasGuardadas, olvidarCompra, type CompraGuardada } from "@/lib/entradas/guardadas";
import { MESES, limpiarDni, validarIdentidad } from "@/lib/entradas/identidad";
import { diaCorto, formatPrecio, horaCorta, whatsappHref } from "@/lib/utils";
import { AvisoNavegadorInterno } from "./AvisoNavegadorInterno";
import { IconDescargar, IconQr, IconReloj, IconWhatsapp } from "./iconos";

interface Detalle {
  id: string;
  estado: string;
  cantidad: number;
  tipoNombre: string;
  montoTotal: number;
  montoRecibido?: number | null;
  problema?: string | null;
  paymentMethod?: string | null;
  evento: { nombre: string; slug: string; fecha: string; lugar: string; flyerUrl: string; colorSecundario: string } | null;
}

type Vista = "confirmada" | "anulada" | "esperando" | "de_menos" | "sin_cupo" | "no_pago";

function vistaDe(d: Detalle): Vista {
  if (d.estado === "aprobado") return "confirmada";
  if (d.estado === "reembolsado") return "anulada";
  // Llegó plata de menos: se muestra aunque la compra haya quedado cerrada.
  if (d.montoRecibido != null) return "de_menos";
  if (d.estado === "rechazado") return "no_pago";
  if (d.problema === "pago_sin_cupo") return "sin_cupo";
  return "esperando";
}

const CHIPS: Record<Vista, { texto: string; clase: string }> = {
  confirmada: { texto: "Confirmada", clase: "border-green-500/40 bg-green-500/10 text-green-300" },
  anulada: { texto: "Anulada", clase: "border-white/20 bg-white/5 text-white/60" },
  esperando: { texto: "Esperando el pago", clase: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  de_menos: { texto: "Pago incompleto", clase: "border-amber-400/40 bg-amber-400/10 text-amber-200" },
  sin_cupo: { texto: "Te devolvemos la plata", clase: "border-red-400/40 bg-red-500/10 text-red-200" },
  no_pago: { texto: "Pago no completado", clase: "border-white/20 bg-white/5 text-white/60" },
};

async function cargarDetalle(ordenId: string): Promise<Detalle | null> {
  const r = await fetch(`/api/ordenes/${ordenId}`, { cache: "no-store" });
  return r.ok ? ((await r.json()) as Detalle) : null;
}

/** Pregunta en Talo / Mercado Pago si una compra sin pagar ya se pagó. */
async function revisar(d: Detalle): Promise<void> {
  const url = d.paymentMethod === "mp" ? "/api/mp/sync" : "/api/talo/sync";
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordenId: d.id }),
  }).catch(() => {});
}

function Tarjeta({ c, whatsapp, onQuitar }: { c: CompraGuardada; whatsapp: string; onQuitar: () => void }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [falla, setFalla] = useState(false);
  const [revisando, setRevisando] = useState(false);

  const actualizar = useCallback(
    async (consultarPago: boolean) => {
      try {
        let det = await cargarDetalle(c.ordenId);
        // También las cerradas que tuvieron una transferencia: quizás la plata llegó después.
        const revisarla =
          det && !det.problema && (det.estado === "pendiente" || (det.estado === "rechazado" && det.paymentMethod === "talo"));
        if (det && consultarPago && revisarla) {
          await revisar(det);
          det = (await cargarDetalle(c.ordenId)) ?? det;
        }
        if (!det) throw new Error();
        setD(det);
        setFalla(false);
        if (det.estado === "aprobado" && c.estado === "pendiente") {
          guardarCompra({ ordenId: c.ordenId, evento: c.evento, fecha: c.fecha, tipo: c.tipo, cantidad: c.cantidad, estado: "aprobado" });
        }
      } catch {
        setFalla(true);
      }
    },
    [c]
  );

  useEffect(() => {
    actualizar(true);
  }, [actualizar]);

  const evento = d?.evento;
  const fecha = evento?.fecha ?? c.fecha;
  const vista = d ? vistaDe(d) : null;
  const codigo = c.ordenId.slice(0, 8).toUpperCase();
  const wa = whatsappHref(whatsapp, `Hola! Es por mi compra ${codigo}${evento ? ` (${evento.nombre})` : ""}.`);

  return (
    <li className="tarjeta flex gap-3.5 p-3 sm:gap-5 sm:p-4">
      <div
        className="relative h-[104px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-white/5 sm:h-[128px] sm:w-[78px]"
        style={evento ? { backgroundColor: evento.colorSecundario } : undefined}
      >
        {evento?.flyerUrl && <Image src={evento.flyerUrl} alt="" fill sizes="80px" className="object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-[15px] font-bold leading-tight sm:text-lg">{evento?.nombre ?? c.evento}</p>
          {vista && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CHIPS[vista].clase}`}>
              {CHIPS[vista].texto}
            </span>
          )}
        </div>
        <p className="text-[13px] text-white/65">
          {fecha ? `${diaCorto(fecha)} · ${horaCorta(fecha)} hs` : ""}
          {evento?.lugar ? ` · ${evento.lugar}` : ""}
        </p>
        <p className="text-[13px] text-white/80">
          {d?.cantidad ?? c.cantidad} × {d?.tipoNombre ?? c.tipo}
          <span className="ml-2 font-mono text-[11px] tracking-[0.1em] text-white/45">{codigo}</span>
        </p>
        {falla ? (
          <p className="text-xs text-amber-200/90">No pudimos cargar esta compra. Probá de nuevo en un rato.</p>
        ) : vista === "confirmada" ? (
          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Link href={`/compra/exito?orden=${c.ordenId}`} className="btn-oro h-10 px-4 text-[13px]">
              <IconQr size={16} />
              Ver QR
            </Link>
            <a href={`/api/ordenes/${c.ordenId}/pdf`} className="btn-borde h-10 px-4 text-[13px]">
              <IconDescargar size={16} />
              PDF
            </a>
          </div>
        ) : vista === "esperando" ? (
          <div className="mt-auto flex flex-col gap-2 pt-1">
            <p className="text-xs leading-relaxed text-white/70">
              Todavía no nos llegó tu transferencia. Apenas llegue, tus entradas aparecen acá.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={revisando}
                onClick={async () => {
                  setRevisando(true);
                  await actualizar(true);
                  setRevisando(false);
                }}
                className="btn-borde h-10 px-4 text-[13px] disabled:opacity-60"
              >
                <IconReloj size={16} />
                {revisando ? "Revisando…" : "Ya pagué, revisar"}
              </button>
              <Link href={`/comprar/pago?orden=${c.ordenId}`} className="inline-flex h-10 items-center px-2 text-[13px] text-white/70 underline">
                Ver datos para pagar
              </Link>
            </div>
          </div>
        ) : vista === "de_menos" && d ? (
          <p className="text-xs leading-relaxed text-amber-200/90">
            Recibimos {formatPrecio(d.montoRecibido ?? 0)} de {formatPrecio(d.montoTotal)}. Escribinos por WhatsApp con tu
            código y lo resolvemos.
          </p>
        ) : vista === "sin_cupo" ? (
          <p className="text-xs leading-relaxed text-red-200/90">
            Tu pago entró pero se agotaron las entradas mientras pagabas. Te devolvemos la plata: escribinos con tu código.
          </p>
        ) : vista === "no_pago" ? (
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <p className="text-xs text-white/60">
              {d?.paymentMethod === "talo"
                ? "Venció el tiempo para transferir. Si transferiste igual, escribinos con tu código."
                : "El pago no se completó y no se cobró nada."}
            </p>
            {d?.paymentMethod !== "talo" && (
              <button type="button" onClick={onQuitar} className="text-xs text-white/60 underline hover:text-white">
                Quitar de la lista
              </button>
            )}
          </div>
        ) : null}
        {wa && (vista === "de_menos" || vista === "sin_cupo" || (vista === "no_pago" && d?.paymentMethod === "talo")) && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-[#25d366] px-4 text-xs font-bold text-[#06240f]"
          >
            <IconWhatsapp size={14} />
            Escribinos
          </a>
        )}
      </div>
    </li>
  );
}

/** "Recuperar mis entradas" con DNI + fecha de nacimiento (para quien cerró la página o cambió de celular). */
function Recuperar({ onEncontradas }: { onEncontradas: (n: number) => void }) {
  const [dni, setDni] = useState("");
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const nacimiento = { dia, mes, anio };
    const invalido = validarIdentidad(dni, nacimiento);
    if (invalido) {
      setError(invalido);
      return;
    }
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni, nacimiento: `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No pudimos buscar tus compras. Probá de nuevo.");
        return;
      }
      const compras = data.compras as {
        ordenId: string;
        estado: string;
        cantidad: number;
        tipoNombre: string;
        evento: { nombre: string; fecha: string } | null;
      }[];
      // Se guardan en este dispositivo: la lista de arriba las muestra con su estado.
      for (const c of [...compras].reverse()) {
        guardarCompra({
          ordenId: c.ordenId,
          evento: c.evento?.nombre ?? "Tu compra",
          fecha: c.evento?.fecha ?? null,
          tipo: c.tipoNombre,
          cantidad: c.cantidad,
          estado: c.estado === "pagada" || c.estado === "anulada" ? "aprobado" : "pendiente",
        });
      }
      onEncontradas(compras.length);
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <form id="recuperar" onSubmit={buscar} className="tarjeta flex scroll-mt-6 flex-col gap-3.5 p-4 sm:p-5">
      <div>
        <p className="font-display text-lg font-extrabold">¿Pagaste y no ves tus entradas?</p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/65">
          Poné el DNI y la fecha de nacimiento que usaste al comprar. Si el pago está confirmado, ves tus QR y bajás el PDF.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rec-dni" className="text-xs font-semibold text-white/65">
          DNI
        </label>
        <input
          id="rec-dni"
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          value={dni}
          onChange={(e) => setDni(limpiarDni(e.target.value).slice(0, 8))}
          className="campo"
          placeholder="Solo números, sin puntos"
        />
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-xs font-semibold text-white/65">Fecha de nacimiento</legend>
        <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
          <input
            aria-label="Día de nacimiento"
            required
            inputMode="numeric"
            maxLength={2}
            value={dia}
            onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="campo text-center"
            placeholder="Día"
          />
          <select
            aria-label="Mes de nacimiento"
            required
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className={`campo ${mes ? "" : "text-white/45"}`}
          >
            <option value="" disabled>
              Mes
            </option>
            {MESES.map((m, i) => (
              <option key={m} value={String(i + 1)} className="text-tinta">
                {m}
              </option>
            ))}
          </select>
          <input
            aria-label="Año de nacimiento"
            required
            inputMode="numeric"
            maxLength={4}
            value={anio}
            onChange={(e) => setAnio(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="campo text-center"
            placeholder="Año"
          />
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <button type="submit" disabled={cargando} className="btn-oro h-12 text-sm disabled:opacity-60">
        {cargando ? "Buscando y revisando el pago…" : "Buscar mis entradas"}
      </button>
      <p className="text-xs text-white/50">
        Sirve para las compras en las que pusiste tu DNI. Si compraste antes de que lo pidiéramos, escribinos por WhatsApp.
      </p>
    </form>
  );
}

export function MisEntradasLista({ whatsapp }: { whatsapp: string }) {
  const [compras, setCompras] = useState<CompraGuardada[] | null>(null);
  const [encontradas, setEncontradas] = useState<number | null>(null);
  const recargar = useCallback(() => setCompras(leerComprasGuardadas()), []);
  useEffect(recargar, [recargar]);
  const wa = whatsappHref(whatsapp, "Hola! Compré entradas y no las encuentro. Mi nombre es ");

  if (compras === null) {
    return <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-oro" />;
  }

  const recuperar = (
    <Recuperar
      onEncontradas={(n) => {
        setEncontradas(n);
        recargar();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <AvisoNavegadorInterno enLista />
      {encontradas !== null && (
        <p role="status" className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {encontradas === 1 ? "Encontramos 1 compra" : `Encontramos ${encontradas} compras`}. Quedan guardadas en este
          dispositivo.
        </p>
      )}
      {compras.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
          {compras.map((c) => (
            <Tarjeta
              key={`${c.ordenId}-${c.estado ?? "a"}`}
              c={c}
              whatsapp={whatsapp}
              onQuitar={() => {
                olvidarCompra(c.ordenId);
                recargar();
              }}
            />
          ))}
        </ul>
      ) : (
        <div className="tarjeta flex flex-col items-center gap-2 px-6 py-8 text-center">
          <p className="font-display text-lg font-bold">No hay compras guardadas acá</p>
          <p className="max-w-sm text-sm text-white/65">
            Las entradas quedan guardadas en el celular o la computadora desde donde se compraron. Si compraste en otro
            dispositivo o cerraste la página, buscalas abajo con tu DNI.
          </p>
        </div>
      )}
      <div className="mx-auto w-full max-w-xl">{recuperar}</div>
      {wa && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[13px] text-white/60">¿No las encontrás igual? Te ayudamos por WhatsApp.</p>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25d366] px-5 text-[13px] font-bold text-[#06240f]"
          >
            <IconWhatsapp size={16} />
            Escribinos
          </a>
        </div>
      )}
    </div>
  );
}

/** Aviso en la portada si en este dispositivo hay compras guardadas. */
export function AvisoMisEntradas() {
  const [compras, setCompras] = useState<CompraGuardada[]>([]);
  useEffect(() => setCompras(leerComprasGuardadas()), []);
  const cantidad = compras.length;
  if (cantidad === 0) {
    return (
      <div className="relative mx-auto mt-3 flex max-w-6xl justify-end px-5 sm:px-8">
        <Link href="/mis-entradas#recuperar" className="text-[13px] text-white/65 underline hover:text-white">
          ¿Ya compraste? Buscá tus entradas con tu DNI
        </Link>
      </div>
    );
  }
  const esperando = compras.some((c) => c.estado === "pendiente");
  return (
    <div className="relative mx-auto mt-4 max-w-6xl px-5 sm:px-8">
      <Link
        href="/mis-entradas"
        className="flex items-center justify-between gap-3 rounded-2xl border border-oro/40 bg-oro/[0.08] px-4 py-3 text-sm transition hover:bg-oro/[0.14]"
      >
        <span className="flex items-center gap-2.5">
          <IconQr size={18} className="text-oro" />
          {esperando
            ? "Tenés una compra esperando la confirmación del pago"
            : cantidad === 1
              ? "Tenés 1 compra en este dispositivo"
              : `Tenés ${cantidad} compras en este dispositivo`}
        </span>
        <span className="whitespace-nowrap font-semibold text-oro-claro">Mis entradas →</span>
      </Link>
    </div>
  );
}
