"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { TicketQrPanel } from "@/components/comprar/TicketQrPanel";
import { IconCheck, IconReloj } from "@/components/publico/iconos";
import type { Orden } from "@/types";

type OrdenConEvento = Orden & { evento: { nombre: string; slug: string } | null };

function ExitoContent() {
  const searchParams = useSearchParams();
  const ordenId = searchParams.get("orden");
  const metodo = searchParams.get("metodo");
  const paymentId = searchParams.get("payment_id") || searchParams.get("collection_id");
  const isMpReturn = metodo === "mp" || Boolean(paymentId);
  const [orden, setOrden] = useState<OrdenConEvento | null>(null);
  const [estado, setEstado] = useState<"cargando" | "pendiente" | "aprobado" | "rechazado" | "error">("cargando");
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

      <div className="text-center">
        <Link href="/" className="text-sm text-white/60 underline hover:text-white">
          Ver otras fiestas
        </Link>
      </div>
    </div>
  );
}

export default function ExitoPage() {
  return (
    <main className="min-h-screen bg-noche px-5 py-10">
      <Suspense
        fallback={
          <div className="flex justify-center pt-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-oro" />
          </div>
        }
      >
        <ExitoContent />
      </Suspense>
    </main>
  );
}
