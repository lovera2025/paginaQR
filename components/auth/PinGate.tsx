"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthRole } from "@/lib/auth/cookies";

/**
 * Protege /admin y /scanner. Sin sesión válida manda a /staff (login con PIN)
 * y vuelve a esta pantalla después de entrar.
 */
export function PinGate({ role, children }: { role: AuthRole; title?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let activo = true;
    const irAlLogin = (expirado: boolean) =>
      router.replace(`/staff?next=${encodeURIComponent(pathname)}${expirado ? "&expirado=1" : ""}`);

    const chequear = (primera: boolean) =>
      fetch("/api/auth/check", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!activo) return;
          const ok = role === "admin" ? d.role === "admin" : d.role === "scanner" || d.role === "admin";
          if (ok) {
            if (primera) setAutorizado(true);
          } else {
            irAlLogin(!primera || Boolean(d.stale));
          }
        })
        .catch(() => primera && irAlLogin(false));

    chequear(true);
    const id = setInterval(() => chequear(false), 30000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [role, pathname, router]);

  if (!autorizado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-noche">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-oro" />
      </div>
    );
  }
  return <>{children}</>;
}
