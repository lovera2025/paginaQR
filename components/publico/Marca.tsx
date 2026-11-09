import Link from "next/link";
import type { Branding } from "@/types";

/** Archivos oficiales de Junior Eventos (versión clara, para fondo oscuro). */
export const MARCA_ISOTIPO = "/marca/isotipo-claro.png";
export const MARCA_NOMBRE = "/marca/nombre-claro.png";
const ISO_RATIO = 487 / 512;
const NOMBRE_RATIO = 900 / 91;

const ALTOS = { sm: 30, md: 40, lg: 52 } as const;

/**
 * Logo de la marca: isotipo + nombre de Junior Eventos.
 * Si en Admin → Marca se sube otro logo, se usa ese. Si la marca cambia de nombre, el nombre va en texto.
 */
export function Marca({
  branding,
  size = "md",
  href = "/",
  compactaEnMovil = false,
}: {
  branding: Pick<Branding, "nombre" | "logoUrl">;
  size?: "sm" | "md" | "lg";
  href?: string | null;
  /** En pantallas chicas muestra solo el isotipo (para headers con botones). */
  compactaEnMovil?: boolean;
}) {
  const nombre = (branding.nombre || "Junior Eventos").trim();
  const esJunior = /junior\s*eventos/i.test(nombre);
  const alto = ALTOS[size];
  const altoNombre = Math.round(alto * 0.36);
  const ocultarNombre = compactaEnMovil ? "hidden sm:block" : "block";

  /* eslint-disable @next/next/no-img-element */
  const contenido = branding.logoUrl ? (
    <img src={branding.logoUrl} alt={nombre} className={size === "lg" ? "h-14 w-auto" : "h-10 w-auto"} />
  ) : (
    <span className="flex items-center gap-2.5">
      <img src={MARCA_ISOTIPO} alt={esJunior ? "" : nombre} width={Math.round(alto * ISO_RATIO)} height={alto} className="shrink-0" />
      {esJunior ? (
        <img
          src={MARCA_NOMBRE}
          alt={nombre}
          width={Math.round(altoNombre * NOMBRE_RATIO)}
          height={altoNombre}
          className={`${ocultarNombre} shrink-0`}
        />
      ) : (
        <span className={`${ocultarNombre} font-display text-sm tracking-[0.08em] text-white`}>{nombre.toUpperCase()}</span>
      )}
      {compactaEnMovil && esJunior && <span className="sr-only sm:hidden">{nombre}</span>}
    </span>
  );
  /* eslint-enable @next/next/no-img-element */

  if (!href) return contenido;
  return (
    <Link href={href} aria-label={`${nombre} — inicio`} className="inline-flex">
      {contenido}
    </Link>
  );
}
