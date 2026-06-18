"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TicketQrPanel } from "@/components/comprar/TicketQrPanel";
import type { Orden } from "@/types";

function ExitoContent() {
  const searchParams = useSearchParams();
  const ordenId = searchParams.get("orden");
  const metodo = searchParams.get("metodo");
  const paymentId =
    searchParams.get("payment_id") || searchParams.get("collection_id");
  const isMpReturn = metodo === "mp" || Boolean(paymentId);
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
      const maxAttempts = isMpReturn ? 15 : 20;

      for (let attempt = 0; attempt < maxAttempts && !cancelled; attempt++) {
        if (attempt > 0 || isMpReturn) {
          if (isMpReturn) {
            await fetch("/api/mp/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ordenId, paymentId }),
            });
          } else {
            await fetch("/api/talo/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ordenId }),
            });
          }
        }

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
          setError("El pago fue rechazado o expiró");
          setLoading(false);
          return;
        }

        if (result.orden?.estado === "pendiente" && attempt === 0) {
          setPending(true);
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!cancelled) {
        setError(
          "Estamos confirmando tu pago. Volvé a esta página en unos minutos con el mismo link."
        );
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ordenId, paymentId, isMpReturn, loadOrden]);

  if (!ordenId) {
    return <p className="text-red-400">Orden no encontrada</p>;
  }

  if (loading) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-white/60">
          {pending
            ? isMpReturn
              ? "Confirmando pago con Mercado Pago..."
              : "Confirmando tu transferencia..."
            : "Cargando..."}
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
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center text-5xl">✅</div>
      <h1 className="mb-2 text-center text-3xl font-black">¡Compra confirmada!</h1>
      <p className="mb-8 text-center text-white/60">
        Presentá cada QR en la entrada el día del evento.
      </p>

      <TicketQrPanel orden={orden} />

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-block rounded-xl bg-white px-6 py-3 font-semibold text-black"
        >
          Volver al evento
        </Link>
      </div>
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
