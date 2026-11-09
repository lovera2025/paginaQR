import { getBranding, getCatalogo } from "@/lib/db";
import { HomeHero } from "@/components/publico/HomeHero";
import { Marquee } from "@/components/publico/Marquee";
import { FiestaCard } from "@/components/publico/FiestaCard";
import { ComoFunciona } from "@/components/publico/ComoFunciona";
import { Faq } from "@/components/publico/Faq";
import { SiteFooter, WhatsappFab } from "@/components/publico/SiteFooter";
import { Reveal } from "@/components/publico/Reveal";
import { AvisoModoPrueba } from "@/components/publico/AvisoModoPrueba";
import { IconMas } from "@/components/publico/iconos";
import { whatsappHref } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [catalogo, branding] = await Promise.all([getCatalogo(), getBranding()]);
  const eventos = catalogo.map((c) => c.evento);
  const ahora = Date.now();
  const proxima =
    catalogo.find((c) => c.evento.estado === "venta" && new Date(c.evento.fecha).getTime() > ahora)?.evento ?? null;
  const flyers = [proxima, ...eventos.filter((e) => e.id !== proxima?.id)]
    .filter((e): e is NonNullable<typeof e> => Boolean(e?.flyerUrl))
    .slice(0, 3)
    .map((e) => ({ src: e.flyerUrl, alt: `Flyer ${e.nombre}` }));
  const wa = whatsappHref(branding.contactoWhatsapp, "Hola! Quiero armar la recepción de mi colegio");

  return (
    <main className="relative min-h-screen overflow-x-clip bg-noche">
      <AvisoModoPrueba />
      <HomeHero branding={branding} proxima={proxima} flyers={flyers} totalFiestas={catalogo.length} />
      <Marquee eventos={eventos} />

      <section id="fiestas" className="mx-auto max-w-6xl scroll-mt-6 px-4 pt-12 sm:px-8 sm:pt-16">
        <Reveal className="mb-5 flex items-end justify-between gap-3 px-1">
          <h2 className="font-display text-[28px] font-extrabold leading-none sm:text-[40px]">
            Elegí tu <span className="text-oro">fiesta</span>
          </h2>
          <span className="whitespace-nowrap text-xs text-white/50 sm:text-sm">
            {catalogo.length} {catalogo.length === 1 ? "recepción" : "recepciones"}
          </span>
        </Reveal>

        {catalogo.length === 0 ? (
          <div className="tarjeta flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="font-script text-5xl text-oro">Próximamente</p>
            <p className="max-w-sm text-sm text-white/60">
              Estamos preparando las fiestas. Seguinos en Instagram para enterarte primero.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {catalogo.map((item, i) => (
              <FiestaCard key={item.evento.id} item={item} index={i} proxima={item.evento.id === proxima?.id} />
            ))}
            <div className="flex aspect-[9/16] flex-col items-center justify-center gap-2.5 rounded-[20px] border border-dashed border-oro/45 bg-oro/[0.05] p-4 text-center">
              <IconMas size={32} className="text-oro" />
              <p className="font-display text-[13px] font-bold sm:text-[15px]">¿Tu colegio no está?</p>
              <p className="text-[11px] leading-snug text-white/60 sm:text-xs">
                Escribinos y armamos tu recepción.
              </p>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-borde mt-1 h-10 px-4 text-xs">
                  Consultar
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      <ComoFunciona />
      <Faq politicaAnulacion={branding.politicaAnulacion} />
      <SiteFooter branding={branding} />
      <WhatsappFab telefono={branding.contactoWhatsapp} />
    </main>
  );
}
