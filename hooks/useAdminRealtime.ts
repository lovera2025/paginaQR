"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

/** Cada cuánto se refresca el panel aunque no lleguen avisos en vivo. */
const INTERVALO_MS = 10_000;

/**
 * Mantiene el panel actualizado.
 * - Refresco periódico (solo con la pestaña visible): compras y entradas están protegidas con RLS,
 *   así que los avisos en vivo de Supabase con la clave pública no llegan para esas tablas.
 * - Avisos en vivo de Supabase cuando llegan (cambios de fiestas).
 */
export function useAdminRealtime(onUpdate: () => void) {
  const cb = useRef(onUpdate);
  cb.current = onUpdate;

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") cb.current();
    };
    const id = setInterval(tick, INTERVALO_MS);
    document.addEventListener("visibilitychange", tick);

    const supabase = createBrowserClient();
    const channel = supabase
      ?.channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => cb.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "ordenes" }, () => cb.current())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => cb.current())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "eventos" }, () => cb.current())
      .subscribe();

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, []);
}
