import type { Metadata } from "next";
import Link from "next/link";
import { getBranding } from "@/lib/db";
import { Marca } from "@/components/publico/Marca";
import { SiteFooter } from "@/components/publico/SiteFooter";
import { MisEntradasLista } from "@/components/publico/MisEntradasLista";
import { IconAtras } from "@/components/publico/iconos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis entradas — Junior Eventos",
  robots: { index: false, follow: false },
};

export default async function MisEntradasPage() {
  const branding = await getBranding();
  return (
    <main className="min-h-screen bg-noche">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-5 sm:px-8">
        <Marca branding={branding} compactaEnMovil />
        <Link href="/" className="inline-flex h-10 items-center gap-1 text-[13px] text-white/70 hover:text-white">
          <IconAtras size={16} />
          Ver fiestas
        </Link>
      </header>
      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8 sm:pt-12">
        <h1 className="font-display text-[28px] font-extrabold leading-none sm:text-[40px]">
          Mis <span className="text-oro">entradas</span>
        </h1>
        <p className="mb-6 mt-2 text-sm text-white/65">Las compras que hiciste desde este celular o computadora.</p>
        <MisEntradasLista whatsapp={branding.contactoWhatsapp} />
      </section>
      <SiteFooter branding={branding} />
    </main>
  );
}
