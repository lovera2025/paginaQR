"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPrecio, whatsappHref } from "@/lib/utils";
import { guardarCompra } from "@/lib/entradas/guardadas";
import { linkPagoVenceEl } from "@/lib/entradas/tipos";
import { IconBanco, IconTarjeta, IconAtras, IconReloj, IconWhatsapp } from "@/components/publico/iconos";
import { BarraModoPrueba } from "@/components/publico/BarraModoPrueba";
import { avisoModoPrueba } from "@/lib/payments/aviso";
import type { Orden, PaymentMethod } from "@/types";

type Resumen = Orden & {
  evento: { nombre: string; slug: string; fecha: string; lugar: string; flyerUrl: string; colorSecundario: string } | null;
  contacto?: { whatsapp: string };
  /** Ya empezó un pago (por ejemplo, se mostró un alias de transferencia). */
  pagoIniciado?: boolean;
};

/** Segundos que faltan para que venza el tiempo de pago (null mientras no se sabe). */
function useSegundosRestantes(venceEl: Date | null): number | null {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!venceEl) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [venceEl]);
  if (!venceEl) return null;
  return Math.max(0, Math.floor((venceEl.getTime() - ahora) / 1000));
}

function RelojReserva({ segundos }: { segundos: number }) {
  const mm = String(Math.floor(segundos / 60)).padStart(2, "0");
  const ss = String(segundos % 60).padStart(2, "0");
  const poco = segundos <= 120;
  return (
    <p
      role="timer"
      aria-live={poco ? "polite" : "off"}
      className={`mb-6 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${
        poco ? "border-amber-400/50 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.04] text-white/75"
      }`}
    >
      <IconReloj size={16} />
      Te guardamos tus entradas:{" "}
      <strong className="font-mono text-base tabular-nums text-white">
        {mm}:{ss}
      </strong>
    </p>
  );
}

function ReservaVencida({ volverHref }: { volverHref: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-400/60 bg-amber-400/10 text-amber-300">
        <IconReloj size={30} />
      </span>
      <h1 className="font-display text-2xl font-extrabold">Se terminó el tiempo para pagar</h1>
      <p className="text-sm leading-relaxed text-white/70">
        No se cobró nada y las entradas se liberaron. Si quedan, las podés elegir de nuevo.
      </p>
      <Link href={volverHref} className="btn-oro mt-2 h-12 px-6 text-sm">
        Elegir de nuevo
      </Link>
    </div>
  );
}

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

/** Respuesta de /api/talo/payment. */
type PasoTalo =
  | ({ tipo: "transferir" } & PaymentInfo)
  | ({ tipo: "incompleto"; recibido: number } & PaymentInfo)
  | { tipo: "aprobada" | "sin_cupo" };

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
  const [recibido, setRecibido] = useState<number | null>(null);
  const [vencidaServidor, setVencidaServidor] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [avisoRevision, setAvisoRevision] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);
  // Se mostró un alias en esta visita (el resumen se pidió antes de eso).
  const [taloIniciado, setTaloIniciado] = useState(false);
  // En desarrollo React corre los efectos dos veces: que no se pidan dos alias para la misma compra.
  const taloPedidoRef = useRef<string | null>(null);
  const volverHref = resumen?.evento ? `/fiesta/${resumen.evento.slug}` : "/";
  const venceEl = useMemo(() => (resumen?.createdAt ? linkPagoVenceEl(resumen) : null), [resumen]);
  const segundos = useSegundosRestantes(venceEl);
  // Si ya empezó una transferencia, el reloj no corre: puede haber transferido y tiene que ver su pago.
  const transferenciaIniciada = Boolean(resumen?.pagoIniciado) || taloIniciado;
  const vencida = vencidaServidor || (segundos === 0 && !transferenciaIniciada);

  useEffect(() => {
    if (!ordenId) return;
    fetch(`/api/ordenes/${ordenId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        // Si ya está paga (ej. volvió con "atrás"), directo a las entradas en vez de ofrecer pagar otra vez.
        if (d.estado === "aprobado" || d.problema) {
          router.replace(`/compra/exito?orden=${ordenId}`);
          return;
        }
        setResumen(d);
      })
      .catch(() => {});
  }, [ordenId, router]);

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

    let res: Response;
    let data: PasoTalo & { error?: string; vencida?: boolean };
    try {
      res = await fetch("/api/talo/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordenId }),
      });
      data = await res.json();
    } catch {
      setError("Sin conexión. Probá de nuevo.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      if (data.vencida) setVencidaServidor(true);
      setError(data.error ?? "No se pudo iniciar el pago con Talo");
      setLoading(false);
      setSelectedMethod(null);
      return;
    }
    // Ya estaba paga (por ejemplo, transfirió y la página se recargó): directo a las entradas.
    if (data.tipo === "aprobada" || data.tipo === "sin_cupo") {
      router.replace(`/compra/exito?orden=${ordenId}&metodo=talo`);
      return;
    }

    const paso = data as Extract<PasoTalo, { tipo: "transferir" | "incompleto" }>;
    setRecibido(paso.tipo === "incompleto" ? paso.recibido : null);
    setTaloIniciado(true);
    setPayment(paso);
    setLoading(false);
  }, [ordenId, router]);

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
          } else if (taloPedidoRef.current !== ordenId) {
            taloPedidoRef.current = ordenId;
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

  /** Pregunta en Talo si llegó la transferencia. Devuelve true si ya no hay que seguir esperando. */
  const revisarTransferencia = useCallback(async (): Promise<boolean> => {
    if (!ordenId) return true;
    let info: { recibido?: number | null } = {};
    try {
      const sync = await fetch("/api/talo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordenId }),
      });
      info = await sync.json().catch(() => ({}));
    } catch {
      return false; // sin conexión: se reintenta
    }
    const ordenRes = await fetch(`/api/ordenes/${ordenId}`, { cache: "no-store" }).catch(() => null);
    const orden = ordenRes?.ok ? await ordenRes.json() : null;
    if (!orden) return false;
    if (orden.estado === "aprobado" || orden.problema) {
      router.push(`/compra/exito?orden=${ordenId}&metodo=talo`);
      return true;
    }
    if (orden.estado === "rechazado") {
      router.push(`/compra/error?orden=${ordenId}`);
      return true;
    }
    const llego = orden.montoRecibido ?? info.recibido ?? null;
    if (llego != null) setRecibido(Number(llego));
    return false;
  }, [ordenId, router]);

  useEffect(() => {
    if (!payment || !ordenId || simulateMode) return;
    // Queda guardada en el dispositivo: si cierra la página, la encuentra en "Mis entradas".
    guardarCompra({
      ordenId,
      evento: resumen?.evento?.nombre ?? "Tu compra",
      fecha: resumen?.evento?.fecha ?? null,
      tipo: resumen?.tipoNombre ?? "Entrada",
      cantidad: resumen?.cantidad ?? 1,
      estado: "pendiente",
    });
  }, [payment, ordenId, simulateMode, resumen]);

  useEffect(() => {
    if (!payment || !ordenId || simulateMode) return;

    let cancelled = false;
    let espera: ReturnType<typeof setTimeout> | null = null;
    let despertar: (() => void) | null = null;
    setWaiting(true);

    // Al volver de la app del banco se consulta enseguida.
    const onVisible = () => {
      if (document.visibilityState === "visible" && despertar) despertar();
    };
    document.addEventListener("visibilitychange", onVisible);

    async function poll() {
      // Sin tope mientras la pantalla esté abierta: cada 3 s los primeros 3 minutos, después cada 15 s.
      for (let i = 0; !cancelled; i++) {
        if (await revisarTransferencia()) return;
        await new Promise<void>((res) => {
          despertar = () => {
            if (espera) clearTimeout(espera);
            res();
          };
          espera = setTimeout(res, i < 60 ? 3000 : 15000);
        });
        despertar = null;
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (espera) clearTimeout(espera);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [payment, ordenId, simulateMode, revisarTransferencia]);

  async function revisarAhora() {
    setRevisando(true);
    setAvisoRevision("");
    const listo = await revisarTransferencia();
    if (!listo) setAvisoRevision("Todavía no nos llegó. Una transferencia puede tardar unos minutos: dejá esta pantalla abierta.");
    setRevisando(false);
  }

  async function copiarLinkCompra() {
    const link = `${window.location.origin}/compra/exito?orden=${ordenId}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      window.prompt("Guardá este link para volver a tu compra:", link);
    }
  }

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

  // Pasó el tiempo para empezar a pagar: se avisa antes de que toque "Pagar" y le dé error.
  // (Si ya generó la transferencia, la pantalla de Talo sigue esperando el pago.)
  if (vencida && !payment && !redirectingMp) {
    return <ReservaVencida volverHref={volverHref} />;
  }
  // Mientras se consulta una transferencia ya iniciada no se muestra el reloj vencido.

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
        {segundos !== null && <RelojReserva segundos={segundos} />}
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
        {segundos !== null && <RelojReserva segundos={segundos} />}
        <h1 className="mb-2 text-center font-display text-2xl font-extrabold">¿Cómo querés pagar?</h1>
        <p className="mb-8 text-center text-sm text-white/60">
          Apenas se confirme el pago, tus entradas con QR aparecen en pantalla para descargar.
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
        {(selectedMethod === "talo" || (methods.length === 1 && methods[0] === "talo") || transferenciaIniciada) && (
          <button
            type="button"
            onClick={() => {
              setSelectedMethod("talo");
              startTalo();
            }}
            className="btn-oro mb-4 h-12 px-6 text-sm"
          >
            Probar de nuevo
          </button>
        )}
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
      {recibido != null ? (
        <div role="alert" className="mb-6 rounded-2xl border border-amber-400/50 bg-amber-400/10 p-5 text-center">
          <p className="font-display text-lg font-extrabold text-amber-200">Llegó menos plata de la que era</p>
          <p className="mt-1 text-sm text-white/80">
            Recibimos <strong>{formatPrecio(recibido)}</strong> de <strong>{formatPrecio(payment.montoTotal)}</strong>{" "}
            (faltan <strong>{formatPrecio(Math.max(0, payment.montoTotal - recibido))}</strong>). Todavía no emitimos tus
            entradas: escribinos con tu código{" "}
            <strong className="font-mono tracking-[0.1em]">{ordenId.slice(0, 8).toUpperCase()}</strong> y lo resolvemos.
          </p>
          {whatsappHref(resumen?.contacto?.whatsapp, `Hola! Transferí de menos en la compra ${ordenId.slice(0, 8).toUpperCase()}. ¿Cómo lo resuelvo?`) && (
            <a
              href={whatsappHref(resumen?.contacto?.whatsapp, `Hola! Transferí de menos en la compra ${ordenId.slice(0, 8).toUpperCase()}. ¿Cómo lo resuelvo?`) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[#25d366] px-4 text-[13px] font-bold text-[#06240f]"
            >
              <IconWhatsapp size={16} />
              Escribinos
            </a>
          )}
        </div>
      ) : (
        <>
          <h1 className="mb-2 text-center font-display text-2xl font-extrabold">Transferí para confirmar</h1>
          <p className="mb-8 text-center text-sm text-white/60">
            Enviá el monto exacto desde tu banco o billetera. Cuando se acredite, tus entradas aparecen solas.
          </p>
        </>
      )}

      {/* Con una transferencia de menos no se muestran los datos para transferir el total otra vez. */}
      {recibido == null && (
      <>
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
          <li>Podés ir a la app de tu banco y volver: esta pantalla se actualiza sola</li>
          <li>
            Si se cierra, tus entradas quedan en <strong>Mis entradas</strong> (o buscalas con tu DNI)
          </li>
        </ul>
      </div>
      </>
      )}

      {waiting && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 px-4 py-4 text-sm text-white/70">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-oro" />
            Esperando confirmación de la transferencia…
          </div>
          <button
            type="button"
            onClick={revisarAhora}
            disabled={revisando}
            className="btn-borde h-11 px-5 text-sm disabled:opacity-60"
          >
            {revisando ? "Revisando…" : "Ya transferí, revisar ahora"}
          </button>
          {avisoRevision && <p className="text-center text-xs text-amber-200/90">{avisoRevision}</p>}
          <p className="text-center text-xs text-white/55">
            Código de compra:{" "}
            <strong className="font-mono tracking-[0.1em] text-white/85">{ordenId.slice(0, 8).toUpperCase()}</strong> ·{" "}
            <button type="button" onClick={copiarLinkCompra} className="underline hover:text-white">
              {linkCopiado ? "¡Link copiado!" : "Copiar link de esta compra"}
            </button>
          </p>
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
