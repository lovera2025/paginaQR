"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { TicketQrPanel } from "@/components/comprar/TicketQrPanel";
import { IconCheck, IconReloj, IconWhatsapp } from "@/components/publico/iconos";
import { BarraModoPrueba } from "@/components/publico/BarraModoPrueba";
import { avisoModoPrueba } from "@/lib/payments/aviso";
import { whatsappHref } from "@/lib/utils";
import type { Orden } from "@/types";

type OrdenConEvento = Orden & {
  evento: { nombre: string; slug: string; contactoWhatsapp?: string } | null;
  contacto?: { whatsapp: string; politicaAnulacion: string };
};

function ExitoContent() {
  const searchParams = useSearchParams();
  const ordenId = searchParams.get("orden");
  const metodo = searchParams.get("metodo");
  const paymentId = searchParams.get("payment_id") || searchParams.get("collection_id");
  const isMpReturn = metodo === "mp" || Boolean(paymentId);
  const [orden, setOrden] = useState<OrdenConEvento | null>(null);
  const [estado, setEstado] = useState<"cargando" | "pendiente" | "aprobado" | "rechazado" | "sin_cupo" | "error">("cargando");
  const [mensaje, setMensaje] = useState("");

  const sincronizar = useCallback(async () => {
    if (!ordenId) return null;
    try {
      await fetch(isMpReturn ? "/api/mp/sync" : "/api/talo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isMpReturn ? { ordenId, paymentId } : { ordenId }),
      });
    } catch {
      /* ignore */
    }
    const res = await fetch(`/api/ordenes/${ordenId}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return { error: data.error as string };
    return { orden: data as OrdenConEvento };
  }, [ordenId, paymentId, isMpReturn]);

  useEffect(() => {
    if (!ordenId) return;
    let cancelado = false;

    async function loop() {
      // Hasta ~2 minutos esperando que el pago se confirme (webhook o consulta).
      for (let i = 0; i < 40 && !cancelado; i++) {
        const r = await sincronizar();
        if (cancelado || !r) return;
        if (!r.orden) {
          setEstado("error");
          setMensaje(r.error ?? "No encontramos la compra");
          return;
        }
        setOrden(r.orden);
        if (r.orden.estado === "aprobado" || r.orden.estado === "reembolsado") {
          setEstado("aprobado");
          return;
        }
        if (r.orden.estado === "rechazado") {
          setEstado("rechazado");
          return;
        }
        if (r.orden.problema === "pago_sin_cupo") {
          setEstado("sin_cupo");
          return;
        }
        setEstado("pendiente");
        await new Promise((res) => setTimeout(res, 3000));
      }
      if (!cancelado) {
        setMensaje("Tu pago todavía se está confirmando. Volvé a abrir este link en unos minutos: tus entradas aparecen acá.");
      }
    }
    loop();
    return () => {
      cancelado = true;
    };
  }, [ordenId, sincronizar]);

  if (!ordenId) {
    return <p className="text-center text-red-300">No encontramos la compra.</p>;
  }

  if (estado === "cargando" || estado === "pendiente") {
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
        <p className="text-[11px] text-white/40">No cierres esta pantalla. Las entradas solo se liberan con el pago confirmado.</p>
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
            ? "El pago fue rechazado o venció. No se cobró nada: podés intentar de nuevo."
            : mensaje}
        </p>
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
          . También te las mandamos a <strong className="text-white">{orden.compradorEmail}</strong>.
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
