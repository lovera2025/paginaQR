"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "framer-motion";
import { EntradaCard } from "@/components/entradas/EntradaCard";
import { IconCompartir, IconCruz, IconDescargar, IconReloj, IconWhatsapp } from "@/components/publico/iconos";
import { horaCorta, whatsappHref } from "@/lib/utils";
import type { Branding, Evento, Orden, Ticket } from "@/types";

interface Datos {
  tickets: Ticket[];
  evento: Evento;
  branding: Branding;
}

function QrImagen({ ticketId }: { ticketId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    QRCode.toDataURL(ticketId, { width: 440, margin: 1, color: { dark: "#000000", light: "#ffffff" } }).then((u) => {
      if (!cancel) setSrc(u);
    });
    return () => {
      cancel = true;
    };
  }, [ticketId]);
  if (!src) {
    return (
      <div className="flex h-[220px] w-[220px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-black/40" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Código QR de ingreso" width={220} height={220} className="block h-[220px] w-[220px]" />;
}

function estadoTicket(t: Ticket): { texto: string; color: string } {
  if (t.cancelado) return { texto: t.reembolsado || t.motivoCancelacion?.startsWith("Anulación") ? "Anulada" : "Dada de baja", color: "#f87171" };
  if (t.usado) return { texto: `Ya ingresó${t.usadoAt ? ` · ${horaCorta(t.usadoAt)}` : ""}`, color: "#fbbf24" };
  return { texto: "Lista para usar", color: "#4ade80" };
}

export function TicketQrPanel({ orden }: { orden: Orden }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/tickets`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar las entradas");
        return;
      }
      const tickets = (data.tickets as Ticket[]).sort((a, b) => a.numeroEntrada - b.numeroEntrada);
      setDatos({ tickets, evento: data.evento, branding: data.branding });
      setSel((actual) =>
        actual && tickets.some((t) => t.id === actual)
          ? actual
          : tickets.find((t) => !t.cancelado && !t.usado)?.id ?? tickets[0]?.id ?? null
      );
    } catch {
      /* sin conexión: se reintenta en el próximo ciclo */
    }
  }, [orden.id]);

  // Se actualiza al volver a la pestaña y cada 30 s (para mostrar "ya ingresó").
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 30000);
    const onVis = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cargar]);

  if (error) return <p className="text-center text-red-300">{error}</p>;
  if (!datos) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-oro" />
      </div>
    );
  }

  const { tickets, evento, branding } = datos;
  const activas = tickets.filter((t) => !t.cancelado);
  const ticket = tickets.find((t) => t.id === sel) ?? tickets[0];
  const marca = evento.organizadorNombre || branding.nombre || "Junior Eventos";
  const wa = whatsappHref(evento.contactoWhatsapp || branding.contactoWhatsapp, `Hola! Consulta por mi compra ${orden.id.slice(0, 8)}`);

  async function compartir(t: Ticket) {
    const url = `${window.location.origin}/api/entradas/${t.id}/pdf`;
    const texto = `Tu entrada ${t.tipoNombre} para ${evento.nombre} (válida una sola vez)`;
    try {
      if (navigator.share) {
        await navigator.share({ title: texto, text: texto, url });
        return;
      }
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}: ${url}`)}`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-col gap-5">
      {activas.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <a href={`/api/ordenes/${orden.id}/pdf`} className="btn-oro h-[54px] text-[15px]">
            <IconDescargar />
            {activas.length > 1 ? `Descargar las ${activas.length} entradas (PDF)` : "Descargar entrada (PDF)"}
          </a>
          <p className="text-center text-[11px] text-white/45">
            Guardala antes de ir: en el predio puede no haber señal.
          </p>
        </div>
      )}

      {tickets.length > 1 && (
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Tus entradas">
          {tickets.map((t) => {
            const e = estadoTicket(t);
            const activo = t.id === ticket?.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setSel(t.id)}
                className={`flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition ${
                  activo ? "border-oro bg-oro/15 text-white" : "border-white/12 text-white/65 hover:border-white/30"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
                Entrada {t.numeroEntrada}
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {ticket && (
          <motion.div
            key={ticket.id + String(ticket.usado) + String(ticket.cancelado)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-3"
          >
            <p className="text-center text-xs font-semibold" style={{ color: estadoTicket(ticket).color }}>
              ● {estadoTicket(ticket).texto}
            </p>
            <EntradaCard
              estilo={ticket.estilo}
              tipoNombre={ticket.tipoNombre}
              evento={evento}
              marca={marca}
              compradorNombre={ticket.compradorNombre}
              numero={ticket.numeroEntrada}
              total={ticket.totalEntradas}
              ticketId={ticket.id}
              qr={
                ticket.cancelado ? (
                  <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 bg-red-50 text-center text-red-700">
                    <IconCruz size={40} />
                    <p className="px-4 text-sm font-bold">{estadoTicket(ticket).texto}</p>
                    {ticket.motivoCancelacion && (
                      <p className="px-4 text-[11px]">{ticket.motivoCancelacion.replace(/^Anulación:\s*/, "")}</p>
                    )}
                    <p className="px-5 text-[11px] leading-snug">Este QR no habilita el ingreso.</p>
                  </div>
                ) : ticket.usado ? (
                  <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2 bg-amber-50 text-center text-amber-700">
                    <IconReloj size={40} />
                    <p className="px-4 text-sm font-bold">Ya ingresó</p>
                    {ticket.usadoAt && <p className="text-lg font-extrabold">{horaCorta(ticket.usadoAt)} hs</p>}
                    <p className="px-5 text-[11px] leading-snug">Este QR ya se usó y no vuelve a validar.</p>
                  </div>
                ) : (
                  <QrImagen ticketId={ticket.id} />
                )
              }
            />
            {!ticket.cancelado && !ticket.usado && (
              <div className="grid grid-cols-2 gap-2.5">
                <a href={`/api/entradas/${ticket.id}/pdf`} className="btn-borde h-11 text-[13px]">
                  <IconDescargar size={16} />
                  Esta entrada
                </a>
                <button type="button" onClick={() => compartir(ticket)} className="btn-borde h-11 text-[13px]">
                  <IconCompartir size={16} />
                  Pasársela a alguien
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="tarjeta flex flex-col gap-1.5 p-4">
        <p className="text-[13px] font-semibold">En la puerta</p>
        <p className="text-xs leading-relaxed text-white/60">
          Mostrá el QR desde el PDF, el mail o esta pantalla. Cada QR entra a una sola persona, una sola vez. No lo
          publiques en redes.
        </p>
      </div>

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 text-sm text-white/70 underline hover:text-white">
          <IconWhatsapp size={16} />
          Dudas por WhatsApp
        </a>
      )}
    </div>
  );
}
