"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPrecio } from "@/lib/utils";
import { IconBanco, IconTarjeta, IconAtras } from "@/components/publico/iconos";
import { BarraModoPrueba } from "@/components/publico/BarraModoPrueba";
import { avisoModoPrueba } from "@/lib/payments/aviso";
import type { Orden, PaymentMethod } from "@/types";

type Resumen = Orden & {
  evento: { nombre: string; slug: string; fecha: string; lugar: string; flyerUrl: string; colorSecundario: string } | null;
};

function ResumenCompra({ r }: { r: Resumen | null }) {
  if (!r) return null;
  return (
    <div className="mb-6 flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
      {r.evento?.flyerUrl && (
        <div className="relative h-[72px] w-[44px] shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: r.evento.colorSecundario }}>
          <Image src={r.evento.flyerUrl} alt="" fill sizes="44px" className="object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-display text-sm font-bold">{r.evento?.nombre ?? "Tu compra"}</span>
        <span className="text-xs text-white/60">
          {r.cantidad} × {r.tipoNombre}
        </span>
      </div>
      <span className="font-display text-lg font-extrabold text-oro-claro">{formatPrecio(r.montoTotal)}</span>
    </div>
  );
}

interface PaymentInfo {
  paymentId: string;
  alias: string;
  cvu: string;
  amount: number;
  compradorEmail: string;
  montoTotal: number;
}

function PagoContent({ onAviso }: { onAviso: (texto: string | null) => void }) {
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
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [sinMedios, setSinMedios] = useState(false);
  const volverHref = resumen?.evento ? `/fiesta/${resumen.evento.slug}` : "/";

  useEffect(() => {
    if (!ordenId) return;
    fetch(`/api/ordenes/${ordenId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setResumen(d))
      .catch(() => {});
  }, [ordenId]);

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
        onAviso(avisoModoPrueba({ simulate, sandbox: Boolean(data.sandbox) }));

        if (simulate) {
          setLoading(false);
          return;
        }

        if (available.length === 0) {
          setSinMedios(true);
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
  }, [ordenId, startMercadoPago, startTalo, onAviso]);

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
        <Link href={volverHref} className="mt-4 inline-block underline">
          Volver
        </Link>
      </div>
    );
  }

  if (loading || redirectingMp) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-oro" />
        <p className="text-white/70">
          {redirectingMp
            ? "Redirigiendo a Mercado Pago..."
            : "Preparando tu pago..."}
        </p>
      </div>
    );
  }

  if (sinMedios) {
    return (
      <div className="mx-auto max-w-md text-center">
        <ResumenCompra r={resumen} />
        <p className="font-display text-xl font-extrabold">Los pagos online no están disponibles ahora</p>
        <p className="mt-2 text-sm text-white/60">No se cobró nada. Escribinos por WhatsApp y te ayudamos con tu entrada.</p>
        <Link href={volverHref} className="mt-6 inline-block text-sm underline">
          Volver a la fiesta
        </Link>
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

        <ResumenCompra r={resumen} />
        <h1 className="mb-2 font-display text-2xl font-extrabold">Confirmar pago</h1>
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
            className="w-full rounded-full bg-green-500 py-4 font-display font-extrabold text-white transition hover:bg-green-600 disabled:opacity-50"
          >
            Simular pago aprobado
          </button>
          <button
            onClick={() => simular(false)}
            disabled={loading}
            className="w-full rounded-full border border-red-500/50 py-4 font-display font-extrabold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            Simular pago rechazado
          </button>
        </div>

        <Link href={volverHref} className="mt-8 inline-block text-sm text-white/40 hover:text-white">
          ← Volver
        </Link>
      </div>
    );
  }

  if (!selectedMethod && methods.length > 1) {
    return (
      <div className="mx-auto max-w-lg">
        <ResumenCompra r={resumen} />
        <h1 className="mb-2 text-center font-display text-2xl font-extrabold">¿Cómo querés pagar?</h1>
        <p className="mb-8 text-center text-sm text-white/60">
          Apenas se confirme el pago, tus entradas con QR aparecen en pantalla y te llegan por mail.
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
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-[#009ee3]/70 hover:bg-[#009ee3]/10"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#009ee3] text-white"><IconTarjeta size={22} /></span>
              <p className="mt-3 font-display text-lg font-extrabold">Tarjeta o saldo</p>
              <p className="mt-1 text-sm text-white/60">Mercado Pago</p>
              <p className="mt-2 text-xs text-white/40">Débito, crédito o saldo MP</p>
            </button>
          )}

          {methods.includes("talo") && (
            <button
              type="button"
              onClick={() => handleChooseMethod("talo")}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-oro/60 hover:bg-oro/10"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-oro text-tinta"><IconBanco size={22} /></span>
              <p className="mt-3 font-display text-lg font-extrabold">Transferencia</p>
              <p className="mt-1 text-sm text-white/60">Talo Pay</p>
              <p className="mt-2 text-xs text-white/40">Desde tu banco o billetera</p>
            </button>
          )}
        </div>

        <Link href={volverHref} className="mt-8 flex items-center justify-center gap-1 text-sm text-white/45 hover:text-white">
          <IconAtras size={16} /> Volver a la fiesta
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
        <Link href={volverHref} className="inline-block underline">
          Volver a comprar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <ResumenCompra r={resumen} />
      <h1 className="mb-2 text-center font-display text-2xl font-extrabold">Transferí para confirmar</h1>
      <p className="mb-8 text-center text-sm text-white/60">
        Enviá el monto exacto desde tu banco o billetera. Cuando se acredite, tus entradas aparecen solas.
      </p>

      <div className="mb-6 rounded-2xl border border-oro/35 bg-oro/[0.08] p-6">
        <p className="mb-1 text-sm text-white/55">Monto a transferir</p>
        <p className="font-display text-4xl font-black text-oro-claro">{formatPrecio(payment.amount)}</p>
      </div>

      {payment.alias && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-2 text-sm text-white/50">Alias</p>
          <div className="flex items-center justify-between gap-3">
            <p className="break-all font-mono text-lg font-semibold">{payment.alias}</p>
            <button
              type="button"
              onClick={() => copyText(payment.alias, "alias")}
              className="shrink-0 rounded-full bg-oro px-4 py-2 text-sm font-bold text-tinta"
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
              className="shrink-0 rounded-full bg-oro px-4 py-2 text-sm font-bold text-tinta"
            >
              {copied === "cvu" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/85">
        <p className="font-semibold text-oro-claro">Importante</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-white/75">
          <li>Transferí el monto exacto: {formatPrecio(payment.amount)}</li>
          <li>Al acreditarse, tus entradas con QR aparecen en pantalla</li>
          <li>Compra registrada a nombre de <strong>{payment.compradorEmail}</strong></li>
          <li>No cierres esta pantalla hasta que confirmemos el pago</li>
        </ul>
      </div>

      {waiting && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-oro" />
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

      <Link href={volverHref} className="mt-4 block text-center text-sm text-white/40 hover:text-white">
        Volver a comprar
      </Link>
    </div>
  );
}

export default function PagoPage() {
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-noche">
      <BarraModoPrueba texto={aviso} />
      <div className="flex min-h-[calc(100vh-28px)] items-center justify-center px-5 py-10">
        <Suspense
          fallback={
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-oro" />
          }
        >
          <div className="w-full min-w-0">
            <PagoContent onAviso={setAviso} />
          </div>
        </Suspense>
      </div>
    </div>
  );
}
