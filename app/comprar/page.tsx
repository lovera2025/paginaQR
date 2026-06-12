import Link from "next/link";
import { getEventoActivo } from "@/lib/db";
import { TicketForm } from "@/components/comprar/TicketForm";
import { formatPrecio } from "@/lib/utils";

export default async function ComprarPage() {
  const evento = await getEventoActivo();

  if (!evento) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>No hay evento activo</p>
      </div>
    );
  }

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

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <TicketForm evento={evento} />
        </div>
      </div>
    </div>
  );
}
