import Link from "next/link";
import type { Branding } from "@/types";
import { instagramHref, whatsappHref } from "@/lib/utils";
import { Marca } from "./Marca";
import { IconCandado, IconInstagram, IconWhatsapp } from "./iconos";

export function SiteFooter({ branding }: { branding: Branding }) {
  const ig = instagramHref(branding.contactoInstagram);
  const wa = whatsappHref(branding.contactoWhatsapp, "Hola! Consulta por las recepciones");
  return (
    <footer className="mt-20 border-t border-white/[0.08]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-2">
          <Marca branding={branding} size="sm" />
          {branding.textoFooter && <p className="max-w-sm text-xs text-white/45">{branding.textoFooter}</p>}
        </div>
        <div className="flex flex-wrap gap-2.5">
          {ig && (
            <a href={ig} target="_blank" rel="noopener noreferrer" className="btn-borde h-11 px-4 text-[13px]">
              <IconInstagram size={16} />@{branding.contactoInstagram.replace(/^@/, "")}
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25d366] px-4 text-[13px] font-bold text-[#06240f]"
            >
              <IconWhatsapp size={16} />
              WhatsApp
            </a>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <p className="text-[11px] text-white/35">
            © {new Date().getFullYear()} {branding.nombre}
          </p>
          <Link
            href="/staff"
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[12px] text-white/45 transition hover:bg-white/5 hover:text-white/80"
          >
            <IconCandado size={14} />
            Login/Staff
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function WhatsappFab({ telefono }: { telefono: string }) {
  const wa = whatsappHref(telefono, "Hola! Consulta por las recepciones");
  if (!wa) return null;
  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consultar por WhatsApp"
      className="fixed bottom-5 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-[#06240f] shadow-[0_10px_30px_rgba(37,211,102,0.45)] transition hover:scale-105"
    >
      <IconWhatsapp size={26} />
    </a>
  );
}
