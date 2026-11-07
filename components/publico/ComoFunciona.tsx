import { IconEscudo, IconQr, IconRayo } from "./iconos";
import { Reveal } from "./Reveal";

const PASOS = [
  {
    t: "Elegí la fiesta y tu entrada",
    d: "Anticipada, General o VIP. Hasta 10 por compra, todas a tu nombre.",
  },
  { t: "Pagá online", d: "Mercado Pago o transferencia. Sin crear cuenta, en menos de un minuto." },
  {
    t: "Mostrá tu QR en la puerta",
    d: "Aparece al instante, te llega por mail y la descargás en PDF. Cada QR vale una sola vez.",
  },
];

export function ComoFunciona() {
  return (
    <section id="como" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <Reveal>
        <h2 className="font-display text-[26px] font-extrabold leading-tight sm:text-4xl">
          Tu entrada en <span className="text-oro">3 pasos</span>
        </h2>
      </Reveal>
      <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {PASOS.map((p, i) => (
          <Reveal key={p.t} delay={i * 0.08}>
            <div className="tarjeta flex h-full gap-4 p-4 sm:flex-col sm:p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-oro font-display text-base font-extrabold text-tinta sm:h-11 sm:w-11">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-display text-[15px] font-bold sm:text-lg">{p.t}</p>
                <p className="text-[13px] leading-relaxed text-white/60 sm:text-sm">{p.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { i: <IconEscudo size={14} className="text-oro" />, t: "Pago seguro" },
          { i: <IconRayo size={14} className="text-oro" />, t: "Entrada al instante" },
          { i: <IconQr size={14} className="text-oro" />, t: "QR de un solo uso" },
        ].map((x) => (
          <span
            key={x.t}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-2 text-[11px] font-semibold text-white/80"
          >
            {x.i}
            {x.t}
          </span>
        ))}
      </div>
    </section>
  );
}
