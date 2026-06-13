import type { Evento } from "@/types";

interface FooterProps {
  evento: Evento;
}

export function Footer({ evento }: FooterProps) {
  const wa = evento.contactoWhatsapp.replace(/\D/g, "");

  return (
    <footer className="border-t border-white/10 bg-black/60 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-bold">Contactanos</h3>
            <p className="mb-4 text-sm text-white/60">{evento.textoFooter}</p>
            <p className="text-sm text-white/80">
              Organiza: {evento.organizadorNombre}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-bold">Enlaces</h3>
            <ul className="space-y-2 text-sm text-white/70">
              {wa && (
                <li>
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-white"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
              {evento.contactoEmail && (
                <li>
                  <a
                    href={`mailto:${evento.contactoEmail}`}
                    className="transition hover:text-white"
                  >
                    {evento.contactoEmail}
                  </a>
                </li>
              )}
              {evento.contactoInstagram && (
                <li>
                  <a
                    href={`https://instagram.com/${evento.contactoInstagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-white"
                  >
                    Instagram {evento.contactoInstagram}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-bold">Ubicación</h3>
            <p className="text-sm text-white/70">{evento.lugar}</p>
            {evento.mapsUrl && (
              <a
                href={evento.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm underline transition hover:text-white"
              >
                Ver en mapa
              </a>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center text-xs text-white/40">
          <a
            href="/admin"
            className="text-white/30 transition hover:text-white/60"
          >
            Admin
          </a>
          <p>
            © {new Date().getFullYear()} {evento.nombre} — Todos los derechos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}
