import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBranding, getEventoBySlug, getEventoCatalogo } from "@/lib/db";
import { requireAuth } from "@/lib/auth/cookies";
import { getMensajePostergado } from "@/lib/evento/messages";
import { getModoPagos } from "@/lib/payments/modo";
import { formatPrecio, horaCorta, whatsappHref, ddmm } from "@/lib/utils";
import { CompraEntradas, StickyCta } from "@/components/publico/CompraEntradas";
import { CompartirBoton } from "@/components/publico/CompartirBoton";
import { Countdown } from "@/components/publico/Countdown";
import { Marca } from "@/components/publico/Marca";
import { SiteFooter, WhatsappFab } from "@/components/publico/SiteFooter";
import { AvisoModoPrueba } from "@/components/publico/AvisoModoPrueba";
import { IconAtras, IconCalendario, IconDisco, IconPin, IconReloj } from "@/components/publico/iconos";
import type { Evento } from "@/types";

export const dynamic = "force-dynamic";

async function cargar(slug: string) {
  const evento = await getEventoBySlug(slug);
  if (!evento) return null;
  const publica = evento.estado === "venta" || evento.estado === "pausado";
  if (!publica && !(await requireAuth("admin"))) return null;
  return { evento, publica };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await cargar(params.slug);
  if (!data) return { title: "Fiesta no encontrada" };
  const { evento } = data;
  const titulo = `${evento.nombre} — Recepción ${ddmm(evento.fecha)}`;
  const descripcion = `${evento.subtitulo || "Recepción Promo 2026"} · ${evento.lugar}. Comprá tu entrada online con QR.`;
  // La imagen para compartir la arma app/fiesta/[slug]/opengraph-image.tsx (flyer + datos, 1200×630).
  return {
    title: titulo,
    description: descripcion,
    openGraph: { title: titulo, description: descripcion, type: "website", locale: "es_AR" },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}

function fechaLarga(e: Evento): string {
  const d = new Date(e.fecha);
  const s = d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return `${s.replace(/\./g, "").replace(/^\w/, (c) => c.toUpperCase())} · ${horaCorta(e.fecha)} hs`;
}

export default async function FiestaPage({ params }: { params: { slug: string } }) {
  const data = await cargar(params.slug);
  if (!data) notFound();
  const { evento, publica } = data;
  const [catalogo, branding, modo] = await Promise.all([getEventoCatalogo(evento.id), getBranding(), getModoPagos()]);
  if (!catalogo) notFound();

  const pausado = evento.estado === "pausado";
  const proximamente = catalogo.proximamente;
  const telefono = evento.contactoWhatsapp || branding.contactoWhatsapp;
  const wa = whatsappHref(telefono, `Hola! Consulta por la recepción ${evento.nombre}`);
  const anticipada = catalogo.tipos.find((t) => t.estilo === "anticipada" && t.comprable && t.ventaHasta);
  const futura = new Date(evento.fecha).getTime() > Date.now();

  return (
    <main className="relative min-h-screen bg-noche pb-28 lg:pb-0">
      <div className="sticky top-0 z-[60]">
        <AvisoModoPrueba sticky={false} />
        {!publica && (
          <div className="border-t border-tinta/20 bg-amber-300 px-4 py-2 text-center text-xs font-bold text-tinta">
            Vista previa — esta fiesta está en borrador y no se ve en la página. Las compras son de prueba.
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:pt-8">
        {/* Flyer */}
        <div className="relative lg:sticky lg:top-8 lg:self-start">
          <div className="relative h-[500px] overflow-hidden sm:h-[620px] lg:aspect-[9/16] lg:h-auto lg:rounded-[26px] lg:border lg:border-white/10 lg:shadow-[0_40px_90px_rgba(0,0,0,0.6)]" style={{ backgroundColor: evento.colorSecundario }}>
            {evento.flyerUrl && (
              <Image
                src={evento.flyerUrl}
                alt={`Flyer ${evento.nombre}`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 460px"
                className={`object-cover object-top ${pausado ? "grayscale-[40%]" : ""}`}
              />
            )}
            <div
              aria-hidden
              className="absolute inset-0 lg:hidden"
              style={{
                background:
                  "linear-gradient(180deg, rgba(5,5,8,0.55) 0%, rgba(5,5,8,0) 22%, rgba(5,5,8,0) 42%, rgba(5,5,8,0.97) 74%, #050508 100%)",
              }}
            />
          </div>
          <Link
            href="/"
            aria-label="Volver a todas las fiestas"
            className="absolute left-3.5 top-3.5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-noche/60 text-white backdrop-blur-md transition hover:bg-noche/80"
          >
            <IconAtras size={20} />
          </Link>
          <CompartirBoton
            titulo={evento.nombre}
            className="absolute right-3.5 top-3.5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-noche/60 text-white backdrop-blur-md transition hover:bg-noche/80"
          />
        </div>

        {/* Info + compra */}
        <div className="relative -mt-24 px-5 sm:px-8 lg:mt-0 lg:px-0">
          <div className="hidden lg:mb-8 lg:block">
            <Marca branding={branding} size="sm" />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {pausado ? (
              <span className="rounded-full bg-amber-400 px-3 py-1.5 font-display text-[10px] font-extrabold tracking-[0.1em] text-tinta">
                POSTERGADA
              </span>
            ) : proximamente ? (
              <span className="rounded-full border border-white/40 bg-noche/70 px-3 py-1.5 font-display text-[10px] font-extrabold tracking-[0.1em] text-white backdrop-blur">
                PRÓXIMAMENTE
              </span>
            ) : catalogo.disponibles > 0 ? (
              <span className="rounded-full bg-oro px-3 py-1.5 font-display text-[10px] font-extrabold tracking-[0.1em] text-tinta">
                EN VENTA{catalogo.disponibles <= 60 ? ` · QUEDAN ${catalogo.disponibles}` : ""}
              </span>
            ) : (
              <span className="rounded-full bg-white/85 px-3 py-1.5 font-display text-[10px] font-extrabold tracking-[0.1em] text-tinta">
                AGOTADA
              </span>
            )}
          </div>

          <p className="eyebrow">{evento.subtitulo || "Recepción · Promo 2026"}</p>
          <h1 className="mt-2 font-display text-[30px] font-black leading-[1.05] tracking-[-0.01em] sm:text-4xl lg:text-[44px]">
            {evento.nombre}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-oro/40 bg-oro/[0.14] px-3 py-2 text-xs font-semibold text-oro-claro">
              <IconCalendario size={14} />
              {fechaLarga(evento)}
            </span>
            {evento.lugar && (
              evento.mapsUrl ? (
                <a href={evento.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/5 px-3 py-2 text-xs font-semibold hover:border-oro/50">
                  <IconPin size={14} className="text-oro" />
                  {evento.lugar}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/5 px-3 py-2 text-xs font-semibold">
                  <IconPin size={14} className="text-oro" />
                  {evento.lugar}
                </span>
              )
            )}
            {evento.dj && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/5 px-3 py-2 text-xs font-semibold">
                <IconDisco size={14} className="text-oro" />
                DJ {evento.dj}
              </span>
            )}
          </div>

          {futura && !pausado && proximamente && (
            <div className="mt-6 flex flex-col gap-3 rounded-[20px] border border-oro/30 bg-oro/[0.05] p-4">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <IconReloj size={15} className="text-oro" />
                {catalogo.abreEl ? (
                  <span>
                    La venta abre el <strong className="text-oro-claro">{ddmm(catalogo.abreEl)}</strong> · {horaCorta(catalogo.abreEl)} hs
                  </span>
                ) : (
                  <span>
                    Venta: <strong className="text-oro-claro">fecha a confirmar</strong>.
                    {/* Con mensaje propio del organizador, el detalle va en la tarjeta de abajo. */}
                    {evento.mensajeProximamente?.trim() ? "" : " Seguinos para enterarte primero."}
                  </span>
                )}
              </div>
              {catalogo.abreEl && <Countdown fecha={catalogo.abreEl} compacto recargarAlTerminar />}
            </div>
          )}

          {futura && !pausado && !proximamente && (
            <div className="mt-6 flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-xs text-white/60">
                <IconReloj size={15} className="text-oro" />
                <span>
                  Falta poco
                  {anticipada?.ventaHasta && (
                    <>
                      {" · "}la anticipada cierra el <strong className="text-oro-claro">{ddmm(anticipada.ventaHasta)}</strong>
                    </>
                  )}
                </span>
              </div>
              <Countdown fecha={evento.fecha} compacto />
            </div>
          )}

          <section id="comprar" className="mt-8 scroll-mt-6">
            {pausado ? (
              <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 p-6">
                <p className="font-display text-lg font-extrabold text-amber-200">Fiesta postergada</p>
                <p className="mt-3 text-sm leading-relaxed text-white/75">{getMensajePostergado(evento)}</p>
                {wa && (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-amber-200 underline">
                    Consultar por WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <CompraEntradas
                evento={catalogo.evento}
                tipos={catalogo.tipos}
                whatsapp={telefono}
                fiestaProximamente={proximamente}
                medios={modo.methods}
              />
            )}
            {!pausado && !proximamente && branding.politicaAnulacion && (
              <p className="mt-4 text-center text-xs leading-relaxed text-white/55">{branding.politicaAnulacion}</p>
            )}
          </section>

          {evento.descripcion && (
            <section className="mt-10 flex flex-col gap-3">
              <h2 className="font-display text-lg font-extrabold">La fiesta</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">{evento.descripcion}</p>
            </section>
          )}

          {evento.mapsUrl && (
            <a
              href={evento.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-6 flex h-36 items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-[#0d1117]"
            >
              <span aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px]" />
              <span className="relative inline-flex h-11 items-center gap-2 rounded-full border border-oro/50 bg-noche/80 px-4 text-[13px] font-semibold text-oro-claro">
                <IconPin size={16} />
                Cómo llegar a {evento.lugar || "la fiesta"}
              </span>
            </a>
          )}
        </div>
      </div>

      <SiteFooter branding={branding} />
      {!pausado && !proximamente && <StickyCta precioDesde={catalogo.precioDesde} targetId="comprar" />}
      {(pausado || proximamente) && <WhatsappFab telefono={telefono} />}
      <span className="sr-only">{catalogo.precioDesde !== null ? `Desde ${formatPrecio(catalogo.precioDesde)}` : ""}</span>
    </main>
  );
}
