import { getEventoActivo } from "@/lib/db";
import { EventHero } from "@/components/landing/EventHero";
import { AboutSection } from "@/components/landing/AboutSection";
import { Footer } from "@/components/landing/Footer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const evento = await getEventoActivo();

  if (!evento) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-white/60">No hay evento activo</p>
      </div>
    );
  }

  return (
    <main>
      <EventHero evento={evento} />
      <AboutSection evento={evento} />
      <Footer evento={evento} />
    </main>
  );
}
