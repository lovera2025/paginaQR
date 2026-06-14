import Image from "next/image";
import Link from "next/link";
import type { Evento } from "@/types";
import { formatFecha, formatPrecio } from "@/lib/utils";

interface EventHeroProps {
  evento: Evento;
}

export function EventHero({ evento }: EventHeroProps) {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {evento.flyerUrl && (
        <Image
          src={evento.flyerUrl}
          alt={evento.nombre}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${evento.colorSecundario}55 0%, #050508 45%, #050508 100%)`,
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        <nav className="flex items-center justify-between px-6 py-6 md:px-10">
          <div className="flex items-center gap-3">
            {evento.logoUrl ? (
              <Image
                src={evento.logoUrl}
                alt="Logo"
                width={48}
                height={48}
                className="rounded-full"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-black"
                style={{ backgroundColor: evento.colorPrimario }}
              >
                QR
              </div>
            )}
            <span className="text-sm font-medium text-white/80">
              {evento.organizadorNombre}
            </span>
          </div>
          <Link
            href="/comprar"
            className="hidden rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:scale-105 md:inline-block"
            style={{ backgroundColor: evento.colorPrimario }}
          >
            Comprar
          </Link>
          <a
            href="/admin"
            className="hidden rounded-full border border-white/10 px-4 py-2 text-xs text-white/40 transition hover:text-white/70 md:inline-block"
          >
            Staff
          </a>
        </nav>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-10 text-center">
          <p
            className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-white/70"
          >
            Entradas disponibles
          </p>
          <h1
            className="mb-6 max-w-4xl text-5xl font-black uppercase leading-none tracking-tight md:text-7xl lg:text-8xl"
            style={{
              textShadow: `0 0 60px ${evento.colorPrimario}88`,
            }}
          >
            {evento.nombre}
          </h1>
          <p className="mb-2 text-lg text-white/80 md:text-xl">
            {formatFecha(evento.fecha)}
          </p>
          <p className="mb-8 text-white/60">{evento.lugar}</p>

          <div
            className="mb-10 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 backdrop-blur-md"
          >
            <p className="text-sm text-white/60">Entrada general</p>
            <p className="text-4xl font-black" style={{ color: evento.colorPrimario }}>
              {formatPrecio(evento.precio)}
            </p>
          </div>

          <Link
            href="/comprar"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-10 py-4 text-lg font-bold text-white shadow-2xl transition hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${evento.colorPrimario}, ${evento.colorSecundario})`,
              boxShadow: `0 0 40px ${evento.colorPrimario}66`,
            }}
          >
            Comprar entrada
            <span className="transition group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
