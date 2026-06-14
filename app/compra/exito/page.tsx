"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Orden } from "@/types";

function ExitoContent() {
  const searchParams = useSearchParams();
  const ordenId = searchParams.get("orden");
  const [orden, setOrden] = useState<Orden | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ordenId) return;
    fetch(`/api/ordenes/${ordenId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else if (data.estado !== "aprobado") {
          setError("Pago no confirmado");
        } else {
          setOrden(data);
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

  if (error || !orden) {
    return <p className="text-red-400">{error || "Orden no encontrada"}</p>;
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mb-6 text-5xl">✅</div>
      <h1 className="mb-2 text-3xl font-black">¡Compra confirmada!</h1>

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
        <p className="mb-3 text-lg font-semibold text-white">
          Tu QR de ingreso fue enviado por mail
        </p>
        <p className="text-white/70">
          Revisá la bandeja de{" "}
          <strong className="text-white">{orden.compradorEmail}</strong>
          {orden.cantidad > 1
            ? ` — ${orden.cantidad} entradas, un QR por cada una.`
            : "."}
        </p>
        <p className="mt-4 text-sm text-white/50">
          Si no lo ves en unos minutos, revisá spam o correo no deseado.
        </p>
        <p className="mt-4 text-sm font-medium text-white/80">
          Presentá el QR del mail en la entrada el día del evento.
        </p>
      </div>

      <Link
        href="/"
        className="inline-block rounded-xl bg-white px-6 py-3 font-semibold text-black"
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
