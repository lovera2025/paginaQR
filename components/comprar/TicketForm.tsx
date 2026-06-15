"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Evento } from "@/types";
import { formatPrecio } from "@/lib/utils";

interface TicketFormProps {
  evento: Evento;
}

export function TicketForm({ evento }: TicketFormProps) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const total = evento.precio * cantidad;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compradorNombre: nombre, compradorEmail: email, cantidad }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error al crear la orden");
      return;
    }

    router.push(`/comprar/pago?orden=${data.ordenId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm text-white/60">Nombre completo</label>
        <input
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/30"
          placeholder="Juan Pérez"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-white/60">Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/30"
          placeholder="juan@email.com"
        />
        <p className="mt-1 text-xs text-white/40">Recibirás tu QR en este email</p>
      </div>

      <div>
        <label className="mb-1 block text-sm text-white/60">Cantidad de entradas</label>
        <select
          value={cantidad}
          onChange={(e) => setCantidad(Number(e.target.value))}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none focus:border-white/30"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "entrada" : "entradas"}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex justify-between text-white/60">
          <span>{cantidad} × {formatPrecio(evento.precio)}</span>
          <span className="text-xl font-bold text-white">{formatPrecio(total)}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-4 font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        style={{
          background: `linear-gradient(135deg, ${evento.colorPrimario}, ${evento.colorSecundario})`,
        }}
      >
        {loading ? "Procesando..." : "Continuar al pago →"}
      </button>
    </form>
  );
}
