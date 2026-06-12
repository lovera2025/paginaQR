"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Orden, Ticket } from "@/types";

interface TicketWithQr extends Ticket {
  qrDataUrl: string;
}

function ExitoContent() {
  const searchParams = useSearchParams();
  const ordenId = searchParams.get("orden");
  const [tickets, setTickets] = useState<TicketWithQr[]>([]);
  const [orden, setOrden] = useState<Orden | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ordenId) return;
    fetch(`/api/ordenes/${ordenId}/tickets`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setTickets(data.tickets);
          setOrden(data.orden);
        }
        setLoading(false);
      });
  }, [ordenId]);

  if (!ordenId) {
    return <p className="text-red-400">Orden no encontrada</p>;
  }

  if (loading) {
    return (
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    );
  }

  if (error) {
    return <p className="text-red-400">{error}</p>;
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mb-6 text-5xl">✅</div>
      <h1 className="mb-2 text-3xl font-black">¡Compra confirmada!</h1>
      {orden && (
        <p className="mb-8 text-white/60">
          Enviamos {tickets.length} QR a{" "}
          <strong className="text-white">{orden.compradorEmail}</strong>
        </p>
      )}

      <div className="space-y-6">
        {tickets.map((t) => (
          <div
            key={t.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <p className="mb-1 font-semibold">{t.compradorNombre}</p>
            <p className="mb-4 text-sm text-white/50">
              Entrada {t.numeroEntrada} de {t.totalEntradas}
            </p>
            <div className="mx-auto inline-block rounded-xl bg-white p-4">
              <Image
                src={t.qrDataUrl}
                alt="QR entrada"
                width={200}
                height={200}
                unoptimized
              />
            </div>
            <p className="mt-4 text-xs text-white/40">
              Presentá este código en la entrada
            </p>
          </div>
        ))}
      </div>

      <Link
        href="/"
        className="mt-8 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-black"
      >
        Volver al evento
      </Link>
    </div>
  );
}

export default function ExitoPage() {
  return (
    <div className="min-h-screen bg-[#050508] px-6 py-12">
      <Suspense
        fallback={
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        }
      >
        <ExitoContent />
      </Suspense>
    </div>
  );
}
