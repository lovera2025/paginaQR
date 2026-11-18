"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { TicketQrPanel } from "@/components/comprar/TicketQrPanel";
import { IconCheck, IconReloj, IconWhatsapp } from "@/components/publico/iconos";
import { BarraModoPrueba } from "@/components/publico/BarraModoPrueba";
import { avisoModoPrueba } from "@/lib/payments/aviso";
import { formatPrecio, whatsappHref } from "@/lib/utils";
import { guardarCompra } from "@/lib/entradas/guardadas";
import type { Orden } from "@/types";

type OrdenConEvento = Orden & {
  pagoIniciado?: boolean;
  evento: { nombre: string; slug: string; fecha?: string; contactoWhatsapp?: string } | null;
  contacto?: { whatsapp: string; politicaAnulacion: string };
};

type Lectura = { orden?: OrdenConEvento; error?: string };

function ExitoContent() {
  const searchParams = useSearchParams();
  const ordenId = searchParams.get("orden");
  const metodo = searchParams.get("metodo");
  const paymentId = searchParams.get("payment_id") || searchParams.get("collection_id");
  const isMpReturn = metodo === "mp" || Boolean(paymentId);
  const [orden, setOrden] = useState<OrdenConEvento | null>(null);
  const [estado, setEstado] = useState<
    "cargando" | "pendiente" | "de_menos" | "aprobado" | "rechazado" | "sin_cupo" | "error"
  >("cargando");
  const [mensaje, setMensaje] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // Una vez leída la compra, un error de lectura es un corte momentáneo: se sigue consultando.
  const leidaRef = useRef(false);

  /** Trae la compra y, si sigue sin pagar, pregunta en Mercado Pago / Talo si ya se pagó. */
  const sincronizar = useCallback(async (): Promise<Lectura | null> => {
    if (!ordenId) return null;
    const leer = async (): Promise<Lectura> => {
      const res = await fetch(`/api/ordenes/${ordenId}`, { cache: "no-store" });
      const data = await res.json();
      return res.ok ? { orden: data as OrdenConEvento } : { error: data.error as string };
    };
    let r = await leer();
    // También las cerradas por vencidas que tuvieron una transferencia: quizás la plata llegó después.
    const revisar =
      r.orden &&
      !r.orden.problema &&
      (r.orden.estado === "pendiente" || (r.orden.estado === "rechazado" && r.orden.paymentMethod === "talo"));
    if (revisar && r.orden) {
      const mp = isMpReturn || r.orden.paymentMethod === "mp";
      try {
        await fetch(mp ? "/api/mp/sync" : "/api/talo/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mp ? { ordenId, paymentId } : { ordenId }),
        });
      } catch {
        /* sin conexión: se reintenta en la próxima vuelta */
      }
      r = await leer();
    }
    return r;
  }, [ordenId, paymentId, isMpReturn]);

  /** Aplica lo que se supo de la compra. Devuelve true si ya no hay que seguir esperando. */
  const aplicar = useCallback((r: Lectura): boolean => {
    if (!r.orden) {
      if (leidaRef.current) return false;
      setEstado("error");
      setMensaje(r.error ?? "No encontramos la compra");
      return true;
    }
    leidaRef.current = true;
    const o = r.orden;
    setOrden(o);
    const guardar = (estadoGuardado: "pendiente" | "aprobado") =>
      guardarCompra({
        ordenId: o.id,
        evento: o.evento?.nombre ?? "Tu compra",
        fecha: o.evento?.fecha ?? null,
        tipo: o.tipoNombre ?? "Entrada",
        cantidad: o.cantidad,
        estado: estadoGuardado,
      });
    if (o.estado === "aprobado" || o.estado === "reembolsado") {
      // Para encontrarlas después en "Mis entradas" desde este mismo dispositivo.
      if (o.estado === "aprobado") guardar("aprobado");
      setEstado("aprobado");
      return true;
    }
    if (o.montoRecibido != null && (o.estado === "pendiente" || o.estado === "rechazado")) {
      guardar("pendiente");
      setEstado("de_menos");
      return false;
    }
    if (o.estado === "rechazado") {
      setEstado("rechazado");
      return true;
    }
    if (o.problema === "pago_sin_cupo") {
      setEstado("sin_cupo");
      return true;
    }
    // Sin pagar todavía: queda guardada en el dispositivo para volver desde "Mis entradas".
    guardar("pendiente");
    setEstado(o.montoRecibido != null ? "de_menos" : "pendiente");
    return false;
  }, []);

  useEffect(() => {
    if (!ordenId) return;
    let cancelado = false;
    let espera: ReturnType<typeof setTimeout> | null = null;
    let despertar: (() => void) | null = null;

    // Al volver a la pestaña (por ejemplo, después de transferir desde la app del banco) se consulta enseguida.
    const onVisible = () => {
      if (document.visibilityState === "visible" && despertar) despertar();
    };
    document.addEventListener("visibilitychange", onVisible);

    async function loop() {
      // Sin tope: cada 3 s los primeros 2 minutos y después cada 15 s, mientras la pantalla esté abierta.
      for (let i = 0; !cancelado; i++) {
        const r = await sincronizar().catch(() => null);
        if (cancelado) return;
        if (r && aplicar(r)) return;
        if (i === 40) {
          setMensaje("Tu pago todavía se está confirmando. Podés dejar esta pantalla abierta: tus entradas aparecen solas.");
        }
        await new Promise<void>((res) => {
          despertar = () => {
            if (espera) clearTimeout(espera);
            res();
          };
          espera = setTimeout(res, i < 40 ? 3000 : 15000);
        });
        despertar = null;
      }
    }
    loop();
    return () => {
      cancelado = true;
      if (espera) clearTimeout(espera);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ordenId, sincronizar, aplicar]);

  async function revisarAhora() {
    setRevisando(true);
    const r = await sincronizar().catch(() => null);
    if (r && !aplicar(r)) {
      setMensaje("Todavía no nos llegó. Una transferencia puede tardar unos minutos: dejá esta pantalla abierta.");
    }
    setRevisando(false);
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      window.prompt("Guardá este link para volver a tu compra:", window.location.href);
    }
  }

  if (!ordenId) {
    return <p className="text-center text-red-300">No encontramos la compra.</p>;
  }

  if (estado === "de_menos" && orden) {
    const codigo = orden.id.slice(0, 8).toUpperCase();
    const wa = orden.contacto?.whatsapp
      ? whatsappHref(
          orden.contacto.whatsapp,
          `Hola! Transferí de menos en la compra ${codigo} (${orden.cantidad} × ${orden.tipoNombre}${orden.evento ? ` · ${orden.evento.nombre}` : ""}). ¿Cómo lo resuelvo?`
        )
      : null;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-400/60 bg-amber-400/10 font-display text-3xl text-amber-300">
          !
        </span>
        <h1 className="font-display text-2xl font-extrabold">Llegó menos plata de la que era</h1>
        <p className="text-sm leading-relaxed text-white/75">
          Recibimos <strong className="text-white">{formatPrecio(orden.montoRecibido ?? 0)}</strong> de{" "}
          <strong className="text-white">{formatPrecio(orden.montoTotal)}</strong>. Todavía no emitimos tus entradas.
        </p>
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm">
          Tu código de compra: <strong className="font-mono tracking-[0.12em] text-oro-claro">{codigo}</strong>
        </p>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-oro h-12 px-6 text-sm">
            <IconWhatsapp size={18} />
            Escribinos y lo resolvemos
          </a>
        ) : (
          <p className="text-xs text-white/60">Comunicate con el organizador con tu código de compra.</p>
        )}
      </div>
    );
  }

  if (estado === "cargando" || estado === "pendiente") {
    const codigo = orden?.id.slice(0, 8).toUpperCase();
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-400/60 bg-amber-400/10 text-amber-300">
          <IconReloj size={30} />
        </span>
        <h1 className="font-display text-2xl font-extrabold">
          {estado === "cargando" ? "Cargando tu compra…" : "Esperando confirmación del pago"}
        </h1>
        <p className="text-sm leading-relaxed text-white/65">
          {mensaje ||
            (isMpReturn
              ? "Mercado Pago nos está confirmando el pago. Tus entradas aparecen solas en unos segundos."
              : "Apenas se confirme el pago, tus entradas aparecen en esta pantalla.")}
        </p>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-oro" />
        {estado === "pendiente" && (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={revisarAhora}
              disabled={revisando}
              className="btn-borde h-11 px-5 text-sm disabled:opacity-60"
            >
              {revisando ? "Revisando…" : "Ya pagué, revisar ahora"}
            </button>
            {codigo && (
              <p className="text-xs text-white/60">
                Código de compra: <strong className="font-mono tracking-[0.1em] text-white/85">{codigo}</strong> ·{" "}
                <button type="button" onClick={copiarLink} className="underline hover:text-white">
                  {copiado ? "¡Link copiado!" : "Copiar link de esta compra"}
                </button>
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-white/55">
          Las entradas solo se liberan con el pago confirmado. Si cerrás esta pantalla, las encontrás en{" "}
          <Link href="/mis-entradas" className="underline">
            Mis entradas
          </Link>{" "}
          con tu DNI.
        </p>
      </div>
    );
  }

  if (estado === "sin_cupo" && orden) {
    const codigo = orden.id.slice(0, 8).toUpperCase();
    const wa = orden.contacto?.whatsapp
      ? whatsappHref(
          orden.contacto.whatsapp,
          `Hola! Pagué la compra ${codigo} (${orden.cantidad} × ${orden.tipoNombre}${orden.evento ? ` · ${orden.evento.nombre}` : ""}) a nombre de ${orden.compradorNombre} y se agotaron las entradas. ¿Cómo sigo con la devolución?`
        )
      : null;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-400/60 bg-amber-400/10 font-display text-3xl text-amber-300">
          !
        </span>
        <h1 className="font-display text-2xl font-extrabold">Se agotaron mientras pagabas</h1>
        <p className="text-sm leading-relaxed text-white/75">
          Tu pago entró, pero justo se vendieron las últimas entradas de{" "}
          <strong className="text-white">{orden.tipoNombre}</strong>. No te emitimos entradas y{" "}
          <strong className="text-white">te devolvemos la plata</strong>: ya le avisamos al organizador.
        </p>
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm">
          Tu código de compra: <strong className="font-mono tracking-[0.12em] text-oro-claro">{codigo}</strong>
        </p>
        <p className="text-xs text-white/60">
          {wa
            ? "Escribinos por WhatsApp con tu código para coordinar la devolución."
            : <>Te contactamos a <strong className="text-white/85">{orden.compradorEmail}</strong> para coordinar la devolución.</>}
        </p>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-oro h-12 px-6 text-sm">
            <IconWhatsapp size={18} />
            Escribinos por WhatsApp
          </a>
        )}
        <Link href={orden.evento ? `/fiesta/${orden.evento.slug}` : "/"} className="text-sm text-white/65 underline hover:text-white">
          Ver si quedan otras entradas
        </Link>
      </div>
    );
  }

  if (estado === "rechazado" || estado === "error" || !orden) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400/60 bg-red-500/10 text-red-300">
          ✕
        </span>
        <h1 className="font-display text-2xl font-extrabold">
          {estado === "rechazado" ? "El pago no se completó" : "No encontramos la compra"}
        </h1>
        <p className="text-sm text-white/65">
          {estado === "rechazado"
            ? orden?.paymentMethod === "talo"
              ? "Venció el tiempo para transferir. Si transferiste y no ves tus entradas, escribinos con tu código de compra."
              : "El pago fue rechazado o venció. No se cobró nada: podés intentar de nuevo."
            : mensaje}
        </p>
        {estado === "rechazado" && orden?.paymentMethod === "talo" && (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm">
            Tu código de compra:{" "}
            <strong className="font-mono tracking-[0.12em] text-oro-claro">{orden.id.slice(0, 8).toUpperCase()}</strong>
          </p>
        )}
        {estado === "rechazado" && orden?.paymentMethod === "talo" && orden.contacto?.whatsapp && (
          <a
            href={
              whatsappHref(
                orden.contacto.whatsapp,
                `Hola! Transferí para la compra ${orden.id.slice(0, 8).toUpperCase()} y figura vencida.`
              ) ?? "#"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25d366] px-5 text-sm font-bold text-[#06240f]"
          >
            <IconWhatsapp size={16} />
            Escribinos
          </a>
        )}
        <Link href={orden?.evento ? `/fiesta/${orden.evento.slug}` : "/"} className="btn-oro mt-2 h-12 px-6 text-sm">
          Volver a intentar
        </Link>
      </div>
    );
  }

  const nombre = orden.compradorNombre.split(" ")[0];
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500 bg-green-500/15 text-green-400"
        >
          <IconCheck size={32} />
        </motion.span>
        <h1 className="font-display text-[26px] font-black leading-tight">¡Pago confirmado!</h1>
        <p className="text-sm leading-relaxed text-white/70">
          {nombre}, tenés <strong className="text-white">{orden.cantidad} {orden.cantidad === 1 ? "entrada" : "entradas"} {orden.tipoNombre}</strong>
          {orden.evento ? (
            <>
              {" "}para <strong className="text-white">{orden.evento.nombre}</strong>
            </>
          ) : null}
          .
        </p>
        <p className="rounded-xl border border-oro/35 bg-oro/[0.08] px-4 py-2.5 text-[13px] leading-relaxed text-white/85">
          <strong className="text-oro-claro">Descargá el PDF</strong> o sacale captura a cada QR: no te llega por mail. Si
          cerrás esta pantalla, las encontrás en <Link href="/mis-entradas" className="font-semibold text-white underline">Mis entradas</Link>{" "}
          (también con tu DNI desde otro celular).
        </p>
      </div>

      <TicketQrPanel orden={orden} />

      {orden.contacto?.whatsapp && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <p className="text-xs leading-relaxed text-white/55">{orden.contacto.politicaAnulacion}</p>
          <a
            href={
              whatsappHref(
                orden.contacto.whatsapp,
                `Hola! Quiero anular mi compra ${orden.id.slice(0, 8).toUpperCase()} (${orden.cantidad} × ${orden.tipoNombre}${orden.evento ? ` · ${orden.evento.nombre}` : ""}) a nombre de ${orden.compradorNombre}.`
              ) ?? "#"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/75 underline hover:text-white"
          >
            <IconWhatsapp size={15} />
            ¿Necesitás anular? Escribinos
          </a>
        </div>
      )}

      <div className="text-center">
        <Link href="/" className="text-sm text-white/60 underline hover:text-white">
          Ver otras fiestas
        </Link>
      </div>
    </div>
  );
}

function AvisoExito() {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/checkout", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTexto(avisoModoPrueba({ simulate: Boolean(d.simulate), sandbox: Boolean(d.sandbox) })))
      .catch(() => {});
  }, []);
  return <BarraModoPrueba texto={texto} />;
}

export default function ExitoPage() {
  return (
    <main className="min-h-screen bg-noche pb-10">
      <AvisoExito />
      <div className="px-5 pt-10">
      <Suspense
        fallback={
          <div className="flex justify-center pt-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-oro" />
          </div>
        }
      >
        <ExitoContent />
      </Suspense>
      </div>
    </main>
  );
}
