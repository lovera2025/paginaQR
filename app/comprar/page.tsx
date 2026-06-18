import Link from "next/link";
import { getEventoActivo } from "@/lib/db";
import { getMensajePostergado } from "@/lib/evento/messages";
import { isVentasPausadas } from "@/lib/evento/estado";
import { TicketForm } from "@/components/comprar/TicketForm";
import { formatPrecio } from "@/lib/utils";

export const dynamic = "force-dynamic";

function whatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default async function ComprarPage() {
  const evento = await getEventoActivo();

  if (!evento) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>No hay evento activo</p>
      </div>
    );
  }

  const pausado = isVentasPausadas(evento.estado);
  const mensaje = getMensajePostergado(evento);
  const wa = whatsappHref(evento.contactoWhatsapp);

  return (
    <div className="min-h-screen bg-[#050508] px-6 py-12">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-8 inline-block text-sm text-white/50 hover:text-white">
          ← Volver al evento
        </Link>

        <h1 className="mb-2 text-3xl font-black">{evento.nombre}</h1>
        <p className="mb-8 text-white/60">
          Entrada: {formatPrecio(evento.precio)} · Sin registro, comprá en segundos
        </p>

        {pausado ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <p className="text-lg font-semibold text-amber-200">Evento postergado</p>
            <p className="mt-3 text-left text-sm leading-relaxed text-white/75">{mensaje}</p>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm font-semibold text-amber-200 underline hover:text-white"
              >
                Contactar por WhatsApp
              </a>
            )}
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl border border-white/20 px-6 py-3 text-sm text-white"
            >
              Volver al evento
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <TicketForm evento={evento} />
          </div>
        )}
      </div>
    </div>
  );
}
