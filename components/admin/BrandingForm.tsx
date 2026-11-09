"use client";

import { useEffect, useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { Marca } from "@/components/publico/Marca";
import type { Branding } from "@/types";

const CAMPOS: { key: keyof Branding; label: string; placeholder?: string; multiline?: boolean }[] = [
  { key: "nombre", label: "Nombre de la marca", placeholder: "Junior Eventos" },
  { key: "tagline", label: "Frase de portada", placeholder: "Recepciones de egresados · Promo 2026" },
  { key: "contactoWhatsapp", label: "WhatsApp (con código de país, ej. 5493777...)", placeholder: "5493777000000" },
  { key: "contactoInstagram", label: "Instagram", placeholder: "junior_eventos_ok" },
  { key: "contactoEmail", label: "Email de contacto" },
  { key: "textoFooter", label: "Texto del pie de página", multiline: true },
  {
    key: "politicaAnulacion",
    label: "Política de anulación (se ve en la fiesta, en Preguntas y al terminar la compra)",
    placeholder: "¿Te arrepentiste? Escribinos por WhatsApp dentro de las 4 horas de la compra…",
    multiline: true,
  },
];

/** Datos globales del sitio: nombre, logo y contacto (se usan en la portada, footer, mail y PDF). */
export function BrandingForm({ onToast }: { onToast: (type: "success" | "error", text: string) => void }) {
  const [b, setB] = useState<Branding | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/admin/branding", { cache: "no-store" })
      .then((r) => r.json())
      .then(setB);
  }, []);

  async function guardar(data: Branding, msg = "Marca guardada") {
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json();
      if (!res.ok) {
        onToast("error", d.error ?? "No se pudo guardar");
        return;
      }
      setB(d);
      onToast("success", msg);
    } finally {
      setGuardando(false);
    }
  }

  if (!b) return <p className="text-white/40">Cargando…</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar(b);
      }}
      className="flex max-w-2xl flex-col gap-4"
    >
      <div>
        <h2 className="font-display text-2xl font-extrabold">Marca</h2>
        <p className="mt-1 text-sm text-white/55">Se usa en la portada, el pie de página, los mails y los PDF de todas las fiestas.</p>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-noche p-5">
        <Marca branding={b} href={null} />
      </div>
      <ImageUploadField
        label="Logo (opcional; si no hay, se usa el nombre en letras)"
        kind="logo"
        eventoId="branding"
        value={b.logoUrl}
        onChange={(url) => guardar({ ...b, logoUrl: url }, url ? "Logo actualizado" : "Logo quitado")}
        onError={(m) => onToast("error", m)}
        previewClassName="h-20 w-48"
      />
      {CAMPOS.map((c) => (
        <label key={c.key} className="flex flex-col gap-1 text-sm text-white/60">
          {c.label}
          {c.multiline ? (
            <textarea
              rows={2}
              value={b[c.key]}
              onChange={(e) => setB({ ...b, [c.key]: e.target.value })}
              className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-[15px] text-white outline-none focus:border-oro/70"
            />
          ) : (
            <input value={b[c.key]} placeholder={c.placeholder} onChange={(e) => setB({ ...b, [c.key]: e.target.value })} className="campo" />
          )}
        </label>
      ))}
      <button type="submit" disabled={guardando} className="btn-oro h-12 self-start px-8 text-sm">
        {guardando ? "Guardando…" : "Guardar marca"}
      </button>
    </form>
  );
}
