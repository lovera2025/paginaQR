import Link from "next/link";
import type { Branding } from "@/types";

/** Logo tipográfico "Junior EVENTOS" (o la imagen de logo si se cargó en Admin → Marca). */
export function Marca({
  branding,
  size = "md",
  href = "/",
}: {
  branding: Pick<Branding, "nombre" | "logoUrl">;
  size?: "sm" | "md" | "lg";
  href?: string | null;
}) {
  const [primera, ...resto] = (branding.nombre || "Junior Eventos").trim().split(/\s+/);
  const script = size === "lg" ? "text-[40px]" : size === "sm" ? "text-[24px]" : "text-[32px]";
  const caps = size === "lg" ? "text-[15px]" : size === "sm" ? "text-[10px]" : "text-[13px]";

  const contenido = branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={branding.logoUrl} alt={branding.nombre} className={size === "lg" ? "h-14 w-auto" : "h-10 w-auto"} />
  ) : (
    <span className="flex items-baseline gap-1.5">
      <span className={`font-script leading-none text-oro ${script}`}>{primera}</span>
      {resto.length > 0 && (
        <span className={`font-display font-extrabold tracking-[0.22em] text-white ${caps}`}>
          {resto.join(" ").toUpperCase()}
        </span>
      )}
    </span>
  );

  if (!href) return contenido;
  return (
    <Link href={href} aria-label={`${branding.nombre} — inicio`} className="inline-flex">
      {contenido}
    </Link>
  );
}
