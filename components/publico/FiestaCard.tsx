"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { EventoCatalogo } from "@/types";
import { ddmm, diaCorto, formatPrecio } from "@/lib/utils";

function badgeDe(item: EventoCatalogo, proxima: boolean): { texto: string; clase: string } | null {
  const { evento, disponibles, anticipadaHasta } = item;
  if (evento.estado === "pausado") return { texto: "POSTERGADA", clase: "bg-amber-400 text-tinta" };
  if (item.proximamente)
    return {
      texto: item.abreEl ? `PRÓXIMAMENTE · ABRE ${ddmm(item.abreEl)}` : "PRÓXIMAMENTE",
      clase: "border border-white/40 bg-noche/75 text-white backdrop-blur",
    };
  if (disponibles <= 0) return { texto: "AGOTADO", clase: "bg-white/85 text-tinta" };
  if (evento.capacidad > 0 && disponibles / evento.capacidad < 0.15)
    return { texto: "ÚLTIMAS ENTRADAS", clase: "bg-naranja text-tinta" };
  if (item.hayProximos && anticipadaHasta) return { texto: "ANTICIPADAS A LA VENTA", clase: "bg-naranja text-tinta" };
  if (proxima) return { texto: "PRÓXIMA", clase: "bg-oro text-tinta" };
  if (anticipadaHasta)
    return {
      texto: `ANTICIPADA HASTA ${ddmm(anticipadaHasta)}`,
      clase: "border border-oro/60 bg-noche/75 text-oro-claro backdrop-blur",
    };
  return null;
}

export function FiestaCard({ item, index, proxima }: { item: EventoCatalogo; index: number; proxima: boolean }) {
  const { evento, precioDesde } = item;
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 200, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 200, damping: 18 });
  const badge = badgeDe(item, proxima);
  const agotado = item.disponibles <= 0;

  function onMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: (index % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 900 }}
    >
      <motion.div style={{ rotateX, rotateY }} whileHover={reduce ? undefined : { y: -6 }}>
        <Link
          href={`/fiesta/${evento.slug}`}
          onPointerMove={onMove}
          onPointerLeave={() => {
            mx.set(0);
            my.set(0);
          }}
          className="group relative block aspect-[9/16] overflow-hidden rounded-[20px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-shadow duration-300 hover:border-oro/40 hover:shadow-[0_28px_70px_rgba(212,168,83,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-oro"
          style={{ backgroundColor: evento.colorSecundario }}
        >
          {evento.flyerUrl ? (
            <Image
              src={evento.flyerUrl}
              alt={`Flyer ${evento.nombre}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
              className={`object-cover transition duration-500 group-hover:scale-[1.04] ${agotado ? "grayscale-[60%]" : ""}`}
            />
          ) : (
            <div className="absolute inset-0 bg-particulas opacity-40" />
          )}
          {badge && (
            <span
              className={`absolute left-2.5 top-2.5 max-w-[calc(100%-20px)] rounded-full px-2.5 py-1 font-display text-[10px] font-extrabold leading-tight tracking-[0.06em] ${badge.clase}`}
            >
              {badge.texto}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-b from-transparent via-noche/85 to-noche/95 px-3 pb-3 pt-14">
            <span className="font-display text-[11px] font-extrabold tracking-[0.1em] text-oro">
              {diaCorto(evento.fecha)}
            </span>
            <span className="line-clamp-2 font-display text-[13px] font-bold leading-tight text-white sm:text-sm">
              {evento.nombre}
            </span>
            <span className="text-xs text-white/70">{evento.lugar}</span>
            {item.proximamente && (
              <span className="mt-1 text-xs font-semibold text-white/75">
                {item.abreEl ? `Venta desde el ${ddmm(item.abreEl)}` : "Próximamente"}
                {precioDesde !== null && (
                  <>
                    {" · desde "}
                    <span className="text-oro">{formatPrecio(precioDesde)}</span>
                  </>
                )}
              </span>
            )}
            {!item.proximamente && precioDesde !== null && (
              <span className="mt-1 text-xs font-semibold text-white">
                {agotado ? (
                  <span className="text-white/60">Sin entradas</span>
                ) : (
                  <>
                    Desde <span className="text-oro">{formatPrecio(precioDesde)}</span>
                  </>
                )}
              </span>
            )}
          </div>
          <span className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-tr from-transparent via-white/0 to-white/0 opacity-0 transition duration-500 group-hover:via-white/[0.06] group-hover:opacity-100" />
        </Link>
      </motion.div>
    </motion.div>
  );
}
