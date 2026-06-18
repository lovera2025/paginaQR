"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { formatFecha } from "@/lib/utils";
import type { Evento, Orden, Ticket } from "@/types";

interface TicketQrPanelProps {
  orden: Orden;
}

function whatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function EventTicketHeader({ evento }: { evento: Evento }) {
  const organizador = evento.organizadorNombre || "JR Eventos";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
      {evento.flyerUrl && (
        <div className="relative h-40 w-full">
          <Image
            src={evento.flyerUrl}
            alt={evento.nombre}
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
          />
        </div>
      )}
      <div className="p-5">
        <div className="mb-4 flex items-center gap-3">
          {evento.logoUrl ? (
            <Image
              src={evento.logoUrl}
              alt={organizador}
              width={48}
              height={48}
              className="rounded-lg"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg text-sm font-black text-white"
              style={{ backgroundColor: evento.colorPrimario }}
            >
              JR
            </div>
          )}
          <span className="text-lg font-bold text-white">{organizador}</span>
        </div>
        <h2 className="text-xl font-black leading-tight text-white">{evento.nombre}</h2>
        <p className="mt-1 text-sm text-white/70">{formatFecha(evento.fecha)}</p>
        {evento.lugar && <p className="mt-1 text-sm text-white/50">{evento.lugar}</p>}
      </div>
    </div>
  );
}

function TicketQrImage({
  ticketId,
  colorPrimario,
}: {
  ticketId: string;
  colorPrimario: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(ticketId, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (!src) {
    return (
      <div className="mx-auto flex h-[260px] w-[260px] items-center justify-center rounded-2xl bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-black/40" />
      </div>
    );
  }

  return (
    <div
      className="mx-auto inline-block rounded-2xl border-2 bg-white p-3"
      style={{ borderColor: colorPrimario }}
    >
      <img src={src} alt="QR de ingreso" width={260} height={260} className="block" />
    </div>
  );
}

function TicketValidityText({
  compradorNombre,
  colorPrimario,
}: {
  compradorNombre: string;
  colorPrimario: string;
}) {
  return (
    <div className="mt-4 space-y-1 text-left text-sm text-white/70">
      <p>
        <span className="text-white/50">Registrada a:</span>{" "}
        <strong className="text-white">{compradorNombre}</strong>
      </p>
      <p>Entrada personal e intransferible.</p>
      <p>Válida hasta el escaneo en la puerta (un solo ingreso).</p>
      <p className="pt-2 text-center text-sm font-semibold text-white">
        Presentá este QR en la entrada
      </p>
      <p className="text-center text-xs" style={{ color: colorPrimario }}>
        {compradorNombre}
      </p>
    </div>
  );
}

function TicketEntry({
  ticket,
  compradorNombre,
  colorPrimario,
  expanded,
  onToggle,
}: {
  ticket: Ticket;
  compradorNombre: string;
  colorPrimario: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const used = ticket.usado;
  const cancelled = ticket.cancelado;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <div>
          <p className="font-semibold text-white">
            Entrada {ticket.numeroEntrada} de {ticket.totalEntradas}
          </p>
          <p className="text-sm text-white/50">
            {cancelled
              ? "Cancelada"
              : used
                ? "Ya ingresó"
                : "Lista para usar en puerta"}
          </p>
        </div>
        <span className="text-lg text-white/60">{expanded ? "▼" : "▶"}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 pb-5 pt-2 text-center">
          {cancelled ? (
            <p className="py-8 text-red-400">Esta entrada fue cancelada.</p>
          ) : used ? (
            <p className="py-8 text-yellow-300">
              Esta entrada ya fue escaneada en la puerta.
            </p>
          ) : (
            <>
              <TicketQrImage ticketId={ticket.id} colorPrimario={colorPrimario} />
              <TicketValidityText
                compradorNombre={compradorNombre}
                colorPrimario={colorPrimario}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function TicketQrPanel({ orden }: TicketQrPanelProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/ordenes/${orden.id}/tickets`);
      const data = await res.json();
      if (cancelled) return;

      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar las entradas");
        setLoading(false);
        return;
      }

      const loaded = (data.tickets ?? []) as Ticket[];
      setTickets(loaded);
      setEvento(data.evento ?? null);
      setExpandedId(loaded[0]?.id ?? null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orden.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-400">{error}</p>;
  }

  if (!evento) {
    return <p className="text-center text-white/60">Evento no encontrado.</p>;
  }

  if (tickets.length === 0) {
    return (
      <p className="text-center text-white/60">
        No hay entradas activas para esta compra.
      </p>
    );
  }

  const multiple = tickets.length > 1;
  const wa = whatsappHref(evento.contactoWhatsapp);

  return (
    <div className="space-y-4 text-left">
      <EventTicketHeader evento={evento} />

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-base text-white/80">
          Hola <strong className="text-white">{orden.compradorNombre}</strong>, confirmamos tu
          compra:{" "}
          <strong className="text-white">
            {tickets.length} entrada{tickets.length > 1 ? "s" : ""}
          </strong>
          .
        </p>
        {multiple && (
          <p className="mt-2 text-sm text-white/50">
            Abrí cada entrada para ver su QR.
          </p>
        )}
      </div>

      {multiple ? (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketEntry
              key={ticket.id}
              ticket={ticket}
              compradorNombre={orden.compradorNombre}
              colorPrimario={evento.colorPrimario}
              expanded={expandedId === ticket.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === ticket.id ? null : ticket.id
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
          {tickets[0].cancelado ? (
            <p className="text-red-400">Esta entrada fue cancelada.</p>
          ) : tickets[0].usado ? (
            <p className="text-yellow-300">Esta entrada ya fue escaneada en la puerta.</p>
          ) : (
            <>
              <TicketQrImage
                ticketId={tickets[0].id}
                colorPrimario={evento.colorPrimario}
              />
              <TicketValidityText
                compradorNombre={orden.compradorNombre}
                colorPrimario={evento.colorPrimario}
              />
            </>
          )}
        </div>
      )}

      <p className="text-center text-sm text-white/50">
        Guardá esta pantalla o sacá captura de cada QR antes del evento.
      </p>

      {evento.textoFooter && (
        <p className="text-center text-xs text-white/40">{evento.textoFooter}</p>
      )}

      {wa && (
        <p className="text-center text-sm">
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/70 underline hover:text-white"
          >
            Dudas por WhatsApp
          </a>
        </p>
      )}
    </div>
  );
}
