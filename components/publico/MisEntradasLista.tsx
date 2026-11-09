"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { leerComprasGuardadas, type CompraGuardada } from "@/lib/entradas/guardadas";
import { diaCorto, horaCorta, whatsappHref } from "@/lib/utils";
import { IconDescargar, IconQr, IconWhatsapp } from "./iconos";

interface Detalle {
  estado: string;
  cantidad: number;
  tipoNombre: string;
  evento: { nombre: string; slug: string; fecha: string; lugar: string; flyerUrl: string; colorSecundario: string } | null;
}

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  aprobado: { texto: "Confirmada", clase: "border-green-500/40 bg-green-500/10 text-green-300" },
  reembolsado: { texto: "Anulada", clase: "border-white/20 bg-white/5 text-white/60" },
};

function Tarjeta({ c }: { c: CompraGuardada }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [falla, setFalla] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/ordenes/${c.ordenId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Detalle) => vivo && setD(data))
      .catch(() => vivo && setFalla(true));
    return () => {
      vivo = false;
    };
  }, [c.ordenId]);

  const evento = d?.evento;
  const fecha = evento?.fecha ?? c.fecha;
  const estado = d ? ESTADOS[d.estado] : null;
  const anulada = d?.estado === "reembolsado";

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
          {estado && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${estado.clase}`}>
              {estado.texto}
            </span>
          )}
        </div>
        <p className="text-[13px] text-white/65">
          {fecha ? `${diaCorto(fecha)} · ${horaCorta(fecha)} hs` : ""}
          {evento?.lugar ? ` · ${evento.lugar}` : ""}
        </p>
        <p className="text-[13px] text-white/80">
          {d?.cantidad ?? c.cantidad} × {d?.tipoNombre ?? c.tipo}
          <span className="ml-2 font-mono text-[11px] tracking-[0.1em] text-white/45">{c.ordenId.slice(0, 8).toUpperCase()}</span>
        </p>
        {falla ? (
          <p className="text-xs text-amber-200/90">No pudimos cargar esta compra. Probá de nuevo en un rato.</p>
        ) : (
          !anulada && (
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
          )
        )}
      </div>
    </li>
  );
}

export function MisEntradasLista({ whatsapp }: { whatsapp: string }) {
  const [compras, setCompras] = useState<CompraGuardada[] | null>(null);
  useEffect(() => setCompras(leerComprasGuardadas()), []);
  const wa = whatsappHref(whatsapp, "Hola! Compré entradas y no las encuentro. Mi nombre es ");

  if (compras === null) {
    return <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-oro" />;
  }

  return (
    <div className="flex flex-col gap-5">
      {compras.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
          {compras.map((c) => (
            <Tarjeta key={c.ordenId} c={c} />
          ))}
        </ul>
      ) : (
        <div className="tarjeta flex flex-col items-center gap-2 px-6 py-10 text-center">
          <p className="font-display text-lg font-bold">No hay compras guardadas acá</p>
          <p className="max-w-sm text-sm text-white/65">
            Las entradas quedan guardadas en el celular o la computadora desde donde se compraron. Si compraste en otro
            dispositivo, entrá desde ese.
          </p>
        </div>
      )}
      {wa && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[13px] text-white/60">¿No encontrás tu entrada? Te la pasamos por WhatsApp.</p>
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
  const [cantidad, setCantidad] = useState(0);
  useEffect(() => setCantidad(leerComprasGuardadas().length), []);
  if (cantidad === 0) return null;
  return (
    <div className="relative mx-auto mt-4 max-w-6xl px-5 sm:px-8">
      <Link
        href="/mis-entradas"
        className="flex items-center justify-between gap-3 rounded-2xl border border-oro/40 bg-oro/[0.08] px-4 py-3 text-sm transition hover:bg-oro/[0.14]"
      >
        <span className="flex items-center gap-2.5">
          <IconQr size={18} className="text-oro" />
          {cantidad === 1 ? "Tenés 1 compra en este dispositivo" : `Tenés ${cantidad} compras en este dispositivo`}
        </span>
        <span className="whitespace-nowrap font-semibold text-oro-claro">Mis entradas →</span>
      </Link>
    </div>
  );
}
