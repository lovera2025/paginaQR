"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Orden } from "@/types";

function ExitoContent() {
  const searchParams = useSearchParams();
  const ordenId = searchParams.get("orden");
  const paymentId =
    searchParams.get("payment_id") || searchParams.get("collection_id");
  const mpReturn = Boolean(paymentId || searchParams.get("collection_status"));
  const [orden, setOrden] = useState<Orden | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const loadOrden = useCallback(async () => {
    if (!ordenId) return null;
    const res = await fetch(`/api/ordenes/${ordenId}`);
    const data = await res.json();
    if (data.error) return { error: data.error as string, orden: null };
    return { error: "", orden: data as Orden };
  }, [ordenId]);

  useEffect(() => {
    if (!ordenId) return;

    let cancelled = false;

    async function load() {
      if (mpReturn) {
        await fetch("/api/mp/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordenId, paymentId }),
        });
      }

      const maxAttempts = mpReturn ? 15 : 1;

      for (let attempt = 0; attempt < maxAttempts && !cancelled; attempt++) {
        const result = await loadOrden();
        if (cancelled || !result) return;

        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }

        if (result.orden?.estado === "aprobado") {
          setOrden(result.orden);
          setPending(false);
          setLoading(false);
          return;
        }

        if (result.orden?.estado === "rechazado") {
          setError("El pago fue rechazado");
          setLoading(false);
          return;
        }

        if (!mpReturn) {
          setError("Pago no confirmado");
          setLoading(false);
          return;
        }

        setPending(true);
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!cancelled) {
        setError("Estamos confirmando tu pago. Revisá tu mail en unos minutos.");
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ordenId, paymentId, mpReturn, loadOrden]);

  if (!ordenId) {
    return <p className="text-red-400">Orden no encontrada</p>;
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-white/60">
          {pending ? "Confirmando pago con Mercado Pago..." : "Cargando..."}
        </p>
      </div>
    );
  }

  if (error && !orden) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-yellow-300">{error}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl border border-white/20 px-6 py-3 text-white"
        >
          Volver al evento
        </Link>
      </div>
    );
  }

  if (!orden) {
    return <p className="text-red-400">Orden no encontrada</p>;
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
