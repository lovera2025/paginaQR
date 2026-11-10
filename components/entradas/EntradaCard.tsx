"use client";

import Image from "next/image";
import { getEstiloEntrada } from "@/lib/entradas/estilos";
import { formatFecha } from "@/lib/utils";
import type { EntradaEstilo } from "@/types";
import { IconCorona } from "@/components/publico/iconos";

export interface EntradaCardProps {
  estilo: EntradaEstilo;
  tipoNombre: string;
  colorAcento?: string;
  evento: {
    nombre: string;
    subtitulo?: string;
    fecha: string;
    lugar: string;
    flyerUrl: string;
    colorPrimario: string;
    colorSecundario: string;
  };
  marca: string;
  compradorNombre: string;
  numero: number;
  total: number;
  ticketId: string;
  /** Contenido del cuadro del QR (imagen, spinner, aviso de "ya ingresó"). */
  qr: React.ReactNode;
  pie?: React.ReactNode;
  compacta?: boolean;
}

/** Entrada digital con el diseño de su tipo (Anticipada / General / VIP / otro color). */
export function EntradaCard(p: EntradaCardProps) {
  const est = getEstiloEntrada({
    estilo: p.estilo,
    nombre: p.tipoNombre,
    colorEvento: p.evento.colorPrimario,
    fondoEvento: p.evento.colorSecundario,
    colorAcento: p.colorAcento,
  });
  const etiqueta = est.estilo === "custom" ? p.tipoNombre.toUpperCase() : est.etiqueta;
  const vip = est.estilo === "vip";
  const idCorto = `${p.ticketId.slice(0, 4)}-${p.ticketId.slice(4, 8)}`.toUpperCase();

  return (
    <article
      className={`relative mx-auto flex w-full max-w-[380px] flex-col overflow-hidden rounded-3xl ${vip ? "vip-foil animate-shine" : ""}`}
      style={{
        backgroundColor: vip ? undefined : est.fondo,
        border: `${vip ? 2 : 1}px solid ${vip ? est.acento : `${est.acento}88`}`,
        boxShadow: vip ? `0 0 0 5px ${est.acento}1f, 0 30px 70px rgba(0,0,0,0.6)` : "0 30px 70px rgba(0,0,0,0.5)",
      }}
    >
      {/* Cabecera */}
      <div className={`relative overflow-hidden ${p.compacta ? "h-24" : "h-[140px]"}`}>
        {p.evento.flyerUrl && (
          <Image
            src={p.evento.flyerUrl}
            alt=""
            fill
            sizes="380px"
            className={`object-cover object-[center_30%] ${vip ? "saturate-[0.6]" : ""}`}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, ${est.fondo}22 0%, ${vip ? "#120e04" : est.fondo}f2 100%)` }}
        />
        {est.cinta && (
          <span
            aria-hidden
            className="absolute -right-11 top-6 w-[180px] rotate-45 py-1.5 text-center font-display text-[11px] font-extrabold tracking-[0.18em]"
            style={{ backgroundColor: est.acento, color: est.sobreAcento }}
          >
            {etiqueta}
          </span>
        )}
        <span
          className="absolute bottom-3 left-5 font-display text-[10px] font-extrabold tracking-[0.22em]"
          style={{ color: vip ? "#f0d389" : est.acento }}
        >
          {p.marca.toUpperCase()}
        </span>
        {!est.cinta && (
          <span
            className="absolute bottom-3 right-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[10px] font-extrabold tracking-[0.16em]"
            style={
              vip
                ? { background: "linear-gradient(135deg,#f0d389,#d4a853 60%,#b8862e)", color: est.sobreAcento }
                : { backgroundColor: est.acento, color: est.sobreAcento }
            }
          >
            {vip && <IconCorona size={11} />}
            {etiqueta}
          </span>
        )}
      </div>

      {/* Corte */}
      <div aria-hidden className="relative h-0 border-t-2 border-dashed" style={{ borderColor: vip ? "rgba(212,168,83,0.4)" : "rgba(255,255,255,0.18)" }}>
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-noche" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-noche" />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-semibold tracking-[0.24em]" style={{ color: vip ? "rgba(240,211,137,0.7)" : "rgba(255,255,255,0.55)" }}>
            {(p.evento.subtitulo || "Recepción · Promo 2026").toUpperCase()}
          </p>
          <h3 className="font-display text-lg font-extrabold leading-tight" style={{ color: est.titulo }}>
            {p.evento.nombre}
          </h3>
          <p className="text-xs text-white/70">
            {formatFecha(p.evento.fecha)}
            {p.evento.lugar ? ` · ${p.evento.lugar}` : ""}
          </p>
        </div>

        <div
          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: `${est.acento}1f`, border: `1px solid ${est.acento}66` }}
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-[10px] tracking-[0.14em] text-white/55">A NOMBRE DE</span>
            <span className="truncate font-display text-sm font-bold">{p.compradorNombre}</span>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 font-display text-[10px] font-extrabold tracking-[0.12em]"
            style={{ backgroundColor: est.acento, color: est.sobreAcento }}
          >
            {vip ? "SECTOR VIP" : etiqueta}
          </span>
        </div>

        <div className="self-center">
          <div
            className="rounded-2xl bg-white p-2.5"
            style={{
              border: `${vip ? 4 : 3}px solid ${est.acento}`,
              boxShadow: est.marcoDoble ? `0 0 0 3px #140f02, 0 0 0 5px #f0d389` : undefined,
            }}
          >
            {p.qr}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-display text-[13px] font-extrabold" style={{ color: vip ? "#f0d389" : "#fff" }}>
            Entrada {p.numero} de {p.total}
          </span>
          <span className="font-mono text-[11px] tracking-[0.1em] text-white/50">ID {idCorto}</span>
        </div>
        {p.pie ?? (
          <p className="text-center text-[11px] leading-snug text-white/55">
            Entrada personal · válida <strong className="text-white">una sola vez</strong> · mostrala en la puerta
          </p>
        )}
      </div>
    </article>
  );
}
