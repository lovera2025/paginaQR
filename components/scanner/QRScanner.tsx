"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import { motion } from "framer-motion";
import { getEstiloEntrada } from "@/lib/entradas/estilos";
import { diaCorto, horaCorta } from "@/lib/utils";
import { IconAtras, IconCheck, IconCorona, IconCruz, IconReloj } from "@/components/publico/iconos";
import type { Evento, VerifyResult, VerifyStatus } from "@/types";

const SCANNER_ID = "qr-reader";
const LS_KEY = "scanner.eventoId";

const PANTALLAS: Record<VerifyStatus, { fondo: string; titulo: string; boton: string }> = {
  valido: { fondo: "linear-gradient(180deg,#0b3b1f 0%,#15803d 100%)", titulo: "¡Entrada válida!", boton: "#0b3b1f" },
  usada: { fondo: "linear-gradient(180deg,#5a3a00 0%,#d97706 100%)", titulo: "Ya ingresó", boton: "#5a3a00" },
  cancelada: { fondo: "linear-gradient(180deg,#5c0f0f 0%,#dc2626 100%)", titulo: "Entrada cancelada", boton: "#5c0f0f" },
  otro_evento: { fondo: "linear-gradient(180deg,#6b2a05 0%,#ea580c 100%)", titulo: "Es de otra fiesta", boton: "#6b2a05" },
  invalido: { fondo: "linear-gradient(180deg,#1f2937 0%,#4b5563 100%)", titulo: "QR no reconocido", boton: "#1f2937" },
};

/** Sonido corto: agudo si está ok, grave si hay problema. */
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = ok ? "sine" : "square";
    osc.frequency.value = ok ? 1046 : 196;
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (ok ? 0.18 : 0.45));
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.2 : 0.5));
    setTimeout(() => ctx.close(), 700);
  } catch {
    /* sin audio */
  }
  if (navigator.vibrate) navigator.vibrate(ok ? 80 : [200, 80, 200]);
}

function Icono({ status }: { status: VerifyStatus }) {
  const cls = "flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-white/60 bg-white/15";
  if (status === "valido") return <span className={cls}><IconCheck size={52} /></span>;
  if (status === "usada") return <span className={cls}><IconReloj size={50} /></span>;
  if (status === "cancelada") return <span className={cls}><IconCruz size={48} /></span>;
  if (status === "otro_evento")
    return (
      <span className={cls}>
        <svg aria-hidden width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h13l-3-3M20 17H7l3 3" />
        </svg>
      </span>
    );
  return <span className={`${cls} font-display text-5xl font-black`}>?</span>;
}

function Resultado({
  result,
  evento,
  onNext,
  auto,
}: {
  result: VerifyResult;
  evento: Evento | null;
  onNext: () => void;
  auto: boolean;
}) {
  const p = PANTALLAS[result.status];
  const t = result.ticket;
  const est = t
    ? getEstiloEntrada({ estilo: t.estilo, nombre: t.tipoNombre, colorEvento: evento?.colorPrimario, fondoEvento: evento?.colorSecundario })
    : null;
  const [restante, setRestante] = useState(auto ? 4 : 0);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setRestante((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [auto]);

  useEffect(() => {
    if (auto && restante <= 0) onNext();
  }, [auto, restante, onNext]);

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-[100dvh] flex-col text-white"
      style={{ background: p.fondo }}
      aria-live="assertive"
    >
      <div className="flex items-center justify-between px-4 pt-4 text-[11px] font-semibold tracking-[0.1em] text-white/80">
        <span>SCANNER</span>
        {evento && <span className="rounded-full bg-black/30 px-2.5 py-1">{diaCorto(evento.fecha)}</span>}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {result.prueba && (
          <span className="rounded-full bg-amber-400 px-3 py-1 font-display text-[11px] font-extrabold tracking-[0.12em] text-[#1a1206]">
            ENTRADA DE PRUEBA
          </span>
        )}
        <Icono status={result.status} />
        <h1 className="mt-2 font-display text-[30px] font-black leading-tight">
          {result.status === "cancelada" && t?.motivoCancelacion?.startsWith("Anulación") ? "Entrada anulada" : p.titulo}
        </h1>

        {result.status === "usada" && t?.usadoAt && (
          <p className="font-display text-4xl font-extrabold">{horaCorta(t.usadoAt)} hs</p>
        )}
        {t && <p className="font-display text-xl font-bold">{t.compradorNombre}</p>}

        {result.status === "valido" && est && (
          <span
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-lg font-black tracking-[0.14em] shadow-lg"
            style={
              est.estilo === "vip"
                ? { background: "linear-gradient(135deg,#f0d389,#d4a853 60%,#b8862e)", color: "#140f02" }
                : { backgroundColor: "#ffffff", color: "#0b3b1f" }
            }
          >
            {est.estilo === "vip" && <IconCorona size={18} />}
            {est.estilo === "vip" ? "SECTOR VIP" : t!.tipoNombre.toUpperCase()}
          </span>
        )}
        {result.status !== "valido" && t && (
          <span className="rounded-full border border-white/50 px-3 py-1.5 font-display text-xs font-extrabold tracking-[0.14em]">
            {t.tipoNombre.toUpperCase()} · {t.numeroEntrada} DE {t.totalEntradas}
          </span>
        )}
        {result.status === "valido" && t && (
          <p className="text-sm text-white/85">
            Entrada {t.numeroEntrada} de {t.totalEntradas}
          </p>
        )}

        {result.status === "otro_evento" && (
          <p className="max-w-xs text-base font-semibold">
            {result.eventoNombre}
            {result.eventoFecha && <span className="block text-sm font-normal text-white/85">{diaCorto(result.eventoFecha)}</span>}
          </p>
        )}
        <p className="max-w-xs text-[13px] leading-snug text-white/85">
          {result.status === "usada"
            ? "Este QR ya se usó. No vuelve a validar."
            : result.status === "cancelada"
              ? `No habilita el ingreso.${t?.motivoCancelacion ? ` Motivo: ${t.motivoCancelacion.replace(/^Anulación:\s*/, "")}.` : ""}`
              : result.status === "otro_evento"
                ? "No se marcó como usada. Verificá la fecha con la persona."
                : result.status === "invalido"
                  ? "No pertenece a ninguna compra. Pedí el mail de confirmación o buscá el nombre en el panel."
                  : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mx-4 mb-6 h-14 rounded-full bg-white font-display text-base font-extrabold"
        style={{ color: p.boton }}
      >
        {auto ? `Siguiente (${Math.max(0, restante)})` : "Escanear siguiente"}
      </button>
    </motion.section>
  );
}

export function QRScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processing = useRef(false);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [eventoId, setEventoId] = useState<string>("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");
  const [ingresos, setIngresos] = useState(0);
  const eventoIdRef = useRef("");

  const evento = eventos?.find((e) => e.id === eventoId) ?? null;

  useEffect(() => {
    fetch("/api/admin/eventos", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const lista = ((d.eventos ?? []) as Evento[]).filter((e) => e.estado !== "finalizado");
        setEventos(lista);
        let guardado = "";
        try {
          guardado = localStorage.getItem(LS_KEY) ?? "";
        } catch {
          /* ignore */
        }
        const elegido =
          lista.find((e) => e.id === guardado)?.id ??
          // Por defecto, la fiesta de hoy (o la próxima).
          [...lista]
            .filter((e) => new Date(e.fecha).getTime() > Date.now() - 12 * 3600 * 1000)
            .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0]?.id ??
          lista[0]?.id ??
          "";
        setEventoId(elegido);
      })
      .catch(() => setEventos([]));
  }, []);

  useEffect(() => {
    eventoIdRef.current = eventoId;
    try {
      if (eventoId) localStorage.setItem(LS_KEY, eventoId);
    } catch {
      /* ignore */
    }
  }, [eventoId]);

  useEffect(() => {
    if (!eventoId) return;
    let mounted = true;
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;

    // stop() tira un error (sin promesa) si la cámara no está andando: pasa si no arrancó
    // (compu sin cámara, permiso negado) o si todavía estaba arrancando al cambiar de fiesta.
    const apagar = () => {
      try {
        if (scanner.isScanning) {
          scanner
            .stop()
            .catch(() => {})
            .finally(() => {
              try {
                scanner.clear();
              } catch {
                /* ya estaba limpio */
              }
            });
        } else {
          scanner.clear();
        }
      } catch {
        /* ya estaba apagado */
      }
    };

    let arrancando = true;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 12, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
        async (decodedText) => {
          if (processing.current) return;
          processing.current = true;
          try {
            scanner.pause(true);
            const res = await fetch(`/api/verificar/${encodeURIComponent(decodedText.trim())}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventoId: eventoIdRef.current }),
            });
            if (res.status === 401) {
              window.location.href = "/staff?next=/scanner&expirado=1";
              return;
            }
            const data: VerifyResult = await res.json();
            if (!mounted) return;
            beep(data.status === "valido");
            if (data.status === "valido") setIngresos((n) => n + 1);
            setResult(data);
          } catch {
            if (mounted) {
              setError("Error de conexión al verificar. Probá de nuevo.");
              processing.current = false;
              try {
                scanner.resume();
              } catch {
                /* ignore */
              }
            }
          }
        },
        () => {}
      )
      .then(() => {
        // Si mientras arrancaba se cambió de fiesta o se salió de la pantalla, se apaga acá.
        if (!mounted) apagar();
      })
      .catch(() => {
        if (mounted) setError("No se pudo abrir la cámara. Revisá los permisos del navegador.");
      })
      .finally(() => {
        arrancando = false;
      });

    return () => {
      mounted = false;
      // Si todavía está arrancando, lo apaga el .then de arriba.
      if (!arrancando) apagar();
    };
  }, [eventoId]);

  const siguiente = useCallback(() => {
    setResult(null);
    setError("");
    processing.current = false;
    try {
      scannerRef.current?.resume();
    } catch {
      window.location.reload();
    }
  }, []);

  return (
    <div className="relative min-h-[100dvh] bg-black text-white">
      {/* El lector queda montado siempre; el resultado se superpone. */}
      <div className={result ? "hidden" : "flex min-h-[100dvh] flex-col"}>
        <header className="flex items-center gap-3 border-b border-white/10 bg-noche px-3 py-3">
          <Link href="/staff" aria-label="Volver al menú" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15">
            <IconAtras size={18} />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <label htmlFor="fiesta-scanner" className="text-[10px] font-semibold tracking-[0.18em] text-white/50">
              FIESTA
            </label>
            {eventos === null ? (
              <span className="text-sm text-white/60">Cargando…</span>
            ) : eventos.length === 0 ? (
              <span className="text-sm text-amber-300">No hay fiestas cargadas</span>
            ) : (
              <select
                id="fiesta-scanner"
                value={eventoId}
                onChange={(e) => setEventoId(e.target.value)}
                className="w-full truncate bg-transparent font-display text-[15px] font-bold text-white outline-none"
              >
                {eventos.map((e) => (
                  <option key={e.id} value={e.id} className="bg-noche">
                    {diaCorto(e.fecha)} · {e.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="font-display text-xl font-extrabold text-green-400 tabular-nums">{ingresos}</span>
            <span className="text-[9px] tracking-[0.14em] text-white/50">INGRESOS</span>
          </div>
        </header>

        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-red-300">{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="btn-oro h-12 px-6 text-sm">
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div id={SCANNER_ID} className="w-full flex-1 [&_video]:!w-full [&_video]:object-cover" />
            <p className="px-4 py-4 text-center text-sm text-white/60">
              {eventoId ? "Apuntá al QR de la entrada" : "Elegí la fiesta para empezar"}
            </p>
          </>
        )}
      </div>

      {result && (
        <Resultado result={result} evento={evento} onNext={siguiente} auto={result.status === "valido"} />
      )}
    </div>
  );
}
