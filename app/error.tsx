"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Si algo falla al cargar una página (ej. la base no responde), en vez de la pantalla genérica. */
export default function ErrorGeneral({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-noche px-6 text-center">
      <p className="font-script text-6xl text-oro">Ups</p>
      <h1 className="font-display text-2xl font-extrabold">Algo no cargó bien</h1>
      <p className="max-w-sm text-sm text-white/70">
        Puede ser un problema momentáneo de conexión. Si estabas pagando, no se cobró nada dos veces: probá de nuevo en
        unos segundos.
      </p>
      <button type="button" onClick={reset} className="btn-oro mt-2 h-12 px-6 text-sm">
        Probar de nuevo
      </button>
      <Link href="/" className="text-sm text-white/65 underline hover:text-white">
        Ir al inicio
      </Link>
    </main>
  );
}
