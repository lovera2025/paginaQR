import type { Evento } from "@/types";

interface AboutSectionProps {
  evento: Evento;
}

export function AboutSection({ evento }: AboutSectionProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <h2
        className="mb-6 text-3xl font-black uppercase"
        style={{ color: evento.colorPrimario }}
      >
        Sobre el evento
      </h2>
      <p className="text-lg leading-relaxed text-white/70">{evento.descripcion}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/50">Capacidad</p>
          <p className="text-2xl font-bold">{evento.capacidad} personas</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-white/50">Reembolsos</p>
          <p className="text-sm text-white/80">
            Contactá al organizador por WhatsApp o email indicando tu nombre y
            email de compra.
          </p>
        </div>
      </div>
    </section>
  );
}
