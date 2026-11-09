"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Branding, Evento, PaymentMethod } from "@/types";
import { diaCorto, textoMedios } from "@/lib/utils";
import { Countdown } from "./Countdown";
import { IconCandado, IconFlecha } from "./iconos";
import { Marca } from "./Marca";
import { AvisoMisEntradas } from "./MisEntradasLista";

const ease = [0.22, 1, 0.36, 1] as const;

/** Abanico chico de flyers para el celular (centro, izquierda, derecha). */
const FAN_MOVIL = [
  { x: 0, top: 0, w: 124, rot: 0, z: 3 },
  { x: -86, top: 24, w: 104, rot: -9, z: 1 },
  { x: 86, top: 24, w: 104, rot: 9, z: 2 },
];

export function HomeHero({
  branding,
  proxima,
  flyers,
  totalFiestas,
  medios,
}: {
  branding: Branding;
  proxima: Evento | null;
  flyers: { src: string; alt: string }[];
  totalFiestas: number;
  medios: PaymentMethod[];
}) {
  const reduce = useReducedMotion();
  const fan = flyers.slice(0, 3);

  return (
    <section className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-0 animate-twinkle bg-particulas opacity-50" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-180px] h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,168,83,0.22),rgba(5,5,8,0)_65%)]"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-5 sm:px-8">
        <Marca branding={branding} compactaEnMovil />
        <nav className="flex items-center gap-3 text-sm sm:gap-6">
          <a href="#como" className="hidden text-white/75 hover:text-white md:inline">
            Cómo funciona
          </a>
          <a href="#faq" className="hidden text-white/75 hover:text-white md:inline">
            Preguntas
          </a>
          <Link
            href="/staff"
            className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap text-[12px] text-white/70 transition hover:text-white sm:text-[13px]"
          >
            <IconCandado size={14} />
            Login/Staff
          </Link>
          <a href="#fiestas" className="btn-oro h-10 px-5 text-[12px] tracking-[0.06em] sm:h-11 sm:text-[13px]">
            ENTRADAS
          </a>
        </nav>
      </header>
      <AvisoMisEntradas />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-10 pt-7 sm:px-8 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-16">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {fan.length > 0 && (
            <div aria-hidden className="relative mb-7 h-[222px] w-full max-w-[320px] sm:hidden">
              {fan.map((f, i) => {
                const pos = FAN_MOVIL[fan.length === 1 ? 0 : i];
                return (
                  <div
                    key={f.src}
                    className="animate-fade-up absolute"
                    style={{
                      left: `calc(50% + ${pos.x}px)`,
                      top: pos.top,
                      width: pos.w,
                      marginLeft: -pos.w / 2,
                      zIndex: pos.z,
                      animationDelay: `${0.05 + i * 0.1}s`,
                    }}
                  >
                    <div
                      className={`relative aspect-[9/16] overflow-hidden rounded-[16px] border ${
                        i === 0
                          ? "border-oro/55 shadow-[0_24px_60px_rgba(212,168,83,0.3)]"
                          : "border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.7)] brightness-[0.8]"
                      }`}
                      style={{ transform: `rotate(${pos.rot}deg)` }}
                    >
                      <Image src={f.src} alt="" fill sizes="130px" className="object-cover" priority={i === 0} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p style={{ animationDelay: "0s" }} className="animate-fade-up eyebrow text-balance">
            {branding.tagline || "Egresados · Promo 2026"}
          </p>
          <h1
            style={{ animationDelay: "0.08s" }}
            className="animate-fade-up mt-4 font-display text-[56px] font-black leading-[0.92] tracking-[-0.03em] [text-shadow:0_0_60px_rgba(212,168,83,0.35)] sm:text-[80px] lg:text-[96px]"
          >
            Recepción
            <br />
            <span className="font-script text-[76px] font-normal leading-[0.85] tracking-normal text-oro sm:text-[104px] lg:text-[124px]">
              baile
            </span>
          </h1>
          <p style={{ animationDelay: "0.16s" }} className="animate-fade-up mt-5 max-w-[460px] text-base leading-relaxed text-white/75 sm:text-lg">
            {totalFiestas > 0
              ? `${totalFiestas} ${totalFiestas === 1 ? "recepción" : "recepciones"} en diciembre. Elegí la de tu colegio, pagá online y tu entrada con QR llega al instante.`
              : "Muy pronto vas a poder comprar tus entradas acá."}
          </p>
          <div style={{ animationDelay: "0.24s" }} className="animate-fade-up mt-7 flex flex-col items-center gap-3 sm:flex-row lg:items-center">
            <a href="#fiestas" className="btn-oro h-14 px-8 text-[15px] animate-pulse-ring">
              Ver las fiestas
              <IconFlecha />
            </a>
            <span className="text-[13px] text-white/60">{textoMedios(medios)}</span>
          </div>

          {proxima && (
            <div
              style={{ animationDelay: "0.32s" }}
              className="animate-fade-up mt-8 w-full max-w-[420px] rounded-[20px] border border-oro/35 bg-white/[0.04] p-4 backdrop-blur-md"
            >
              <Link href={`/fiesta/${proxima.slug}`} className="mb-3 block text-left text-[10.5px] font-semibold tracking-[0.2em] text-white/60 hover:text-white">
                PRÓXIMA · {proxima.nombre.replace(/["“”]/g, "").toUpperCase()} · {diaCorto(proxima.fecha)}
              </Link>
              <Countdown fecha={proxima.fecha} />
            </div>
          )}
        </div>

        {fan.length > 0 && (
          <div aria-hidden className="relative mx-auto hidden h-[520px] w-full max-w-[520px] sm:block">
            {fan.map((f, i) => {
              const pos = [
                { left: "4%", top: 60, rotate: -12, z: 1, w: 220 },
                { left: "50%", top: 0, rotate: 0, z: 3, w: 250 },
                { left: "auto", top: 50, rotate: 12, z: 2, w: 220 },
              ][fan.length === 1 ? 1 : i === 0 ? 1 : i === 1 ? 0 : 2];
              const centro = pos.left === "50%";
              return (
                <motion.div
                  key={f.src}
                  className="absolute"
                  style={{
                    left: pos.left === "auto" ? undefined : pos.left,
                    right: pos.left === "auto" ? "4%" : undefined,
                    top: pos.top,
                    width: pos.w,
                    marginLeft: centro ? -pos.w / 2 : undefined,
                    zIndex: pos.z,
                  }}
                  initial={reduce ? false : { opacity: 0, y: 40, rotate: 0 }}
                  animate={reduce ? { rotate: pos.rotate } : { opacity: 1, y: [0, -8, 0], rotate: pos.rotate }}
                  transition={
                    reduce
                      ? undefined
                      : {
                          opacity: { duration: 0.8, delay: 0.2 + i * 0.12 },
                          rotate: { duration: 0.9, delay: 0.2 + i * 0.12, ease },
                          y: { duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 },
                        }
                  }
                >
                  <div
                    className={`relative aspect-[9/16] overflow-hidden rounded-[22px] border ${
                      centro ? "border-oro/50 shadow-[0_40px_90px_rgba(212,168,83,0.3)]" : "border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.7)]"
                    }`}
                  >
                    <Image src={f.src} alt={f.alt} fill sizes="260px" className="object-cover" priority={i === 0} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
