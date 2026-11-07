"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ErrorContent() {
  const ordenId = useSearchParams().get("orden");
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!ordenId) return;
    fetch(`/api/ordenes/${ordenId}`)
      .then((r) => r.json())
      .then((d) => setSlug(d?.evento?.slug ?? null))
      .catch(() => {});
  }, [ordenId]);

  return (
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400/60 bg-red-500/10 text-2xl text-red-300">
        ✕
      </span>
      <h1 className="font-display text-2xl font-extrabold">Pago no realizado</h1>
      <p className="text-sm text-white/65">
        El pago fue rechazado o cancelado y no se cobró nada. Podés intentar de nuevo con otro medio.
      </p>
      <Link href={slug ? `/fiesta/${slug}` : "/"} className="btn-oro mt-2 h-12 px-6 text-sm">
        Reintentar compra
      </Link>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-noche px-6">
      <Suspense>
        <ErrorContent />
      </Suspense>
    </main>
  );
}
