/** Barra con el aviso de pagos de prueba (sirve en server y client). */
export function BarraModoPrueba({ texto, sticky = true }: { texto: string | null; sticky?: boolean }) {
  if (!texto) return null;
  return (
    <div
      role="status"
      className={`${sticky ? "sticky top-0 z-[60]" : ""} bg-amber-400 px-4 py-1.5 text-center font-display text-[11px] font-extrabold tracking-[0.08em] text-tinta`}
    >
      {texto}
    </div>
  );
}
