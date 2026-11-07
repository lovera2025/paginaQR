import type { Evento } from "@/types";
import { diaCorto } from "@/lib/utils";

function corto(nombre: string): string {
  return nombre
    .replace(/["“”]/g, "")
    .replace(/^(Colegio Secundario( de)?|Escuela (Técnica|Parroquial|Normal)( Arq\.)?)\s+/i, "")
    .toUpperCase();
}

/** Cinta animada con las fechas de todas las fiestas. */
export function Marquee({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) return null;
  const items = eventos.map((e) => `${diaCorto(e.fecha)} · ${corto(e.nombre)}`);
  const fila = (key: string) => (
    <div key={key} className="flex shrink-0 items-center gap-7 pr-7" aria-hidden={key === "b"}>
      {items.map((t, i) => (
        <span key={`${key}-${i}`} className="flex items-center gap-7">
          <span>{t}</span>
          <span className="text-white/30">✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative overflow-hidden border-y border-oro/25 bg-oro/[0.06] py-3">
      <div className="flex w-max animate-marquee whitespace-nowrap font-display text-[13px] font-extrabold tracking-[0.18em] text-oro hover:[animation-play-state:paused] sm:text-[15px]">
        {fila("a")}
        {fila("b")}
      </div>
    </div>
  );
}
