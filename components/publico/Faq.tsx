import { IconChevron } from "./iconos";

const PREGUNTAS = [
  {
    q: "¿Qué diferencia hay entre Anticipada, General y VIP?",
    a: "La Anticipada es la misma entrada que la General pero más barata, y se vende hasta una fecha o hasta agotar cupo. La VIP suma beneficios exclusivos (sector VIP, barra y más, según cada fiesta).",
  },
  {
    q: "¿Cuándo salen la General y la VIP?",
    a: "Primero se venden las Anticipadas. Cuando una entrada dice “Próximamente”, todavía no está a la venta: si tiene cuenta regresiva abre sola ese día; si dice “fecha a confirmar”, lo anunciamos en Instagram y WhatsApp.",
  },
  {
    q: "¿Puedo comprar para mis amigos?",
    a: "Sí. Podés comprar hasta 10 entradas del mismo tipo en una compra. Cada una tiene su propio QR: descargá el PDF y pasale a cada uno la suya.",
  },
  {
    q: "¿Dónde está mi entrada?",
    a: "Aparece en pantalla apenas se confirma el pago, la podés descargar en PDF y además te llega por mail. Si no ves el mail, revisá Spam o Promociones.",
  },
  {
    q: "¿Qué pasa si alguien copia mi QR?",
    a: "Cada QR entra una sola vez. El primero que lo escanea en la puerta pasa; después figura como “ya ingresó”. No compartas tu QR en redes.",
  },
  {
    q: "¿Se puede pagar en la puerta?",
    a: "Las entradas se venden online. Consultá por WhatsApp si quedan entradas el día de la fiesta.",
  },
];

export function Faq({ politicaAnulacion = "" }: { politicaAnulacion?: string }) {
  const preguntas = politicaAnulacion
    ? [...PREGUNTAS, { q: "¿Puedo anular mi compra?", a: politicaAnulacion }]
    : PREGUNTAS;
  return (
    <section id="faq" className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Preguntas frecuentes</h2>
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        {preguntas.map((p) => (
          <details key={p.q} className="tarjeta group px-4 py-1 open:border-oro/30 sm:px-5">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[14px] font-semibold sm:text-[15px] [&::-webkit-details-marker]:hidden">
              {p.q}
              <IconChevron className="shrink-0 text-oro transition group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-[13.5px] leading-relaxed text-white/65">{p.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
