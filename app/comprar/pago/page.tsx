"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function PagoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ordenId = searchParams.get("orden");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!ordenId) {
    return (
      <div className="text-center">
        <p className="text-red-400">Orden no encontrada</p>
        <Link href="/comprar" className="mt-4 inline-block underline">
          Volver
        </Link>
      </div>
    );
  }

  async function simular(exito: boolean) {
    setLoading(true);
    setError("");
    const endpoint = exito
      ? "/api/mock/payment-success"
      : "/api/mock/payment-fail";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenId }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    if (exito) {
      router.push(`/compra/exito?orden=${ordenId}`);
    } else {
      router.push(`/compra/error?orden=${ordenId}`);
    }
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
        <p className="text-sm font-semibold text-yellow-300">Modo simulación</p>
        <p className="mt-1 text-xs text-white/60">
          En producción serás redirigido a Mercado Pago
        </p>
      </div>

      <h1 className="mb-2 text-2xl font-bold">Confirmar pago</h1>
      <p className="mb-8 text-white/60">
        Elegí el resultado para probar el flujo
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <button
          onClick={() => simular(true)}
          disabled={loading}
          className="w-full rounded-xl bg-green-500 py-4 font-bold text-white transition hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? "Procesando..." : "✅ Simular pago exitoso"}
        </button>
        <button
          onClick={() => simular(false)}
          disabled={loading}
          className="w-full rounded-xl border border-red-500/50 py-4 font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          ❌ Simular pago fallido
        </button>
      </div>

      <Link href="/comprar" className="mt-8 inline-block text-sm text-white/40 hover:text-white">
        ← Volver
      </Link>
    </div>
  );
}

export default function PagoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050508] px-6">
      <Suspense
        fallback={
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        }
      >
        <PagoContent />
      </Suspense>
    </div>
  );
}
