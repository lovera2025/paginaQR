"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatPrecio } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

interface PaymentInfo {
  paymentId: string;
  alias: string;
  cvu: string;
  amount: number;
  compradorEmail: string;
  montoTotal: number;
}

function PagoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ordenId = searchParams.get("orden");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [simulateMode, setSimulateMode] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [copied, setCopied] = useState<"alias" | "cvu" | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [redirectingMp, setRedirectingMp] = useState(false);

  const startMercadoPago = useCallback(async () => {
    if (!ordenId) return;
    setRedirectingMp(true);
    setError("");

    const res = await fetch("/api/mp/preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "No se pudo iniciar el pago con Mercado Pago");
      setRedirectingMp(false);
      setSelectedMethod(null);
      return;
    }

    if (data.initPoint) {
      window.location.href = data.initPoint;
      return;
    }

    setError("Mercado Pago no devolvió URL de pago");
    setRedirectingMp(false);
    setSelectedMethod(null);
  }, [ordenId]);

  const startTalo = useCallback(async () => {
    if (!ordenId) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/talo/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "No se pudo iniciar el pago con Talo");
      setLoading(false);
      setSelectedMethod(null);
      return;
    }

    setPayment(data);
    setLoading(false);
  }, [ordenId]);

  useEffect(() => {
    if (!ordenId) return;

    fetch("/api/checkout")
      .then((r) => r.json())
      .then((data) => {
        const simulate = Boolean(data.simulate);
        const available = (data.methods ?? []) as PaymentMethod[];
        setSimulateMode(simulate);
        setMethods(available);

        if (simulate) {
          setLoading(false);
          return;
        }

        if (available.length === 1) {
          const only = available[0];
          setSelectedMethod(only);
          if (only === "mp") {
            startMercadoPago();
          } else {
            startTalo();
          }
          return;
        }

        setLoading(false);
      })
      .catch(() => {
        setError("Error al cargar opciones de pago");
        setLoading(false);
      });
  }, [ordenId, startMercadoPago, startTalo]);

  useEffect(() => {
    if (!payment || !ordenId || simulateMode) return;

    let cancelled = false;
    setWaiting(true);

    async function poll() {
      for (let i = 0; i < 120 && !cancelled; i++) {
        await fetch("/api/talo/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ordenId,
            paymentId: payment?.paymentId,
          }),
        });

        const ordenRes = await fetch(`/api/ordenes/${ordenId}`);
        const orden = await ordenRes.json();

        if (orden.estado === "aprobado") {
          router.push(`/compra/exito?orden=${ordenId}&metodo=talo`);
          return;
        }
        if (orden.estado === "rechazado") {
          router.push(`/compra/error?orden=${ordenId}`);
          return;
        }

        await new Promise((r) => setTimeout(r, 3000));
      }

      if (!cancelled) setWaiting(false);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [payment, ordenId, router, simulateMode]);

  async function handleChooseMethod(method: PaymentMethod) {
    setSelectedMethod(method);
    if (method === "mp") {
      await startMercadoPago();
    } else {
      await startTalo();
    }
  }

  async function copyText(text: string, field: "alias" | "cvu") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("No se pudo copiar. Seleccioná el texto manualmente.");
    }
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

  if (loading || redirectingMp) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-white/70">
          {redirectingMp
            ? "Redirigiendo a Mercado Pago..."
            : "Preparando tu pago..."}
        </p>
      </div>
    );
  }

  if (simulateMode) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <p className="text-sm font-semibold text-yellow-300">Modo simulación</p>
          <p className="mt-1 text-xs text-white/60">
            Configurá Talo o Mercado Pago en Admin → Pagos para cobros reales
          </p>
        </div>

        <h1 className="mb-2 text-2xl font-bold">Confirmar pago</h1>
        <p className="mb-8 text-white/60">Elegí el resultado para probar el flujo</p>

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
            ✅ Simular pago exitoso
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

  if (!selectedMethod && methods.length > 1) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-center text-2xl font-bold">¿Cómo querés pagar?</h1>
        <p className="mb-8 text-center text-white/60">
          Elegí el método que prefieras. Al confirmar el pago verás tu QR en pantalla.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {methods.includes("mp") && (
            <button
              type="button"
              onClick={() => handleChooseMethod("mp")}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-white/30 hover:bg-white/10"
            >
              <p className="text-2xl">💳</p>
              <p className="mt-3 text-lg font-bold">Tarjeta</p>
              <p className="mt-1 text-sm text-white/60">Mercado Pago</p>
              <p className="mt-2 text-xs text-white/40">Débito, crédito o saldo MP</p>
            </button>
          )}

          {methods.includes("talo") && (
            <button
              type="button"
              onClick={() => handleChooseMethod("talo")}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-white/30 hover:bg-white/10"
            >
              <p className="text-2xl">🏦</p>
              <p className="mt-3 text-lg font-bold">Transferencia</p>
              <p className="mt-1 text-sm text-white/60">Talo Pay</p>
              <p className="mt-2 text-xs text-white/40">Desde tu banco o billetera</p>
            </button>
          )}
        </div>

        <Link href="/comprar" className="mt-8 block text-center text-sm text-white/40 hover:text-white">
          ← Volver
        </Link>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-red-400">{error || "No se pudo cargar el pago"}</p>
        {methods.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setError("");
              setSelectedMethod(null);
              setPayment(null);
            }}
            className="mb-4 text-sm underline text-white/60 hover:text-white"
          >
            Elegir otro método de pago
          </button>
        )}
        <Link href="/comprar" className="inline-block underline">
          Volver a comprar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-center text-2xl font-bold">Transferí para confirmar</h1>
      <p className="mb-8 text-center text-white/60">
        Enviá el monto exacto desde tu banco o billetera. Cuando Talo detecte el pago,
        verás tu QR en pantalla.
      </p>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="mb-1 text-sm text-white/50">Monto a transferir</p>
        <p className="text-3xl font-black">{formatPrecio(payment.amount)}</p>
      </div>

      {payment.alias && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-2 text-sm text-white/50">Alias</p>
          <div className="flex items-center justify-between gap-3">
            <p className="break-all font-mono text-lg font-semibold">{payment.alias}</p>
            <button
              type="button"
              onClick={() => copyText(payment.alias, "alias")}
              className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black"
            >
              {copied === "alias" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {payment.cvu && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-2 text-sm text-white/50">CVU</p>
          <div className="flex items-center justify-between gap-3">
            <p className="break-all font-mono text-lg font-semibold">{payment.cvu}</p>
            <button
              type="button"
              onClick={() => copyText(payment.cvu, "cvu")}
              className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black"
            >
              {copied === "cvu" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
        <p className="font-semibold">Importante</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-blue-100/90">
          <li>Transferí el monto exacto: {formatPrecio(payment.amount)}</li>
          <li>Al confirmarse, tu QR aparecerá en pantalla</li>
          <li>Compra registrada a nombre de <strong>{payment.compradorEmail}</strong></li>
          <li>No cierres esta pantalla hasta que confirmemos el pago</li>
        </ul>
      </div>

      {waiting && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          Esperando confirmación de la transferencia...
        </div>
      )}

      {methods.length > 1 && (
        <button
          type="button"
          onClick={() => {
            setSelectedMethod(null);
            setPayment(null);
            setWaiting(false);
          }}
          className="mt-6 block w-full text-center text-sm text-white/40 hover:text-white"
        >
          ← Elegir otro método de pago
        </button>
      )}

      <Link href="/comprar" className="mt-4 block text-center text-sm text-white/40 hover:text-white">
        Volver a comprar
      </Link>
    </div>
  );
}

export default function PagoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050508] px-6 py-10">
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
