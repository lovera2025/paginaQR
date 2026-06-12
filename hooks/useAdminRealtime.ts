"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function useAdminRealtime(onUpdate: () => void) {
  useEffect(() => {
    const supabase = createBrowserClient();
    if (!supabase) {
      const id = setInterval(onUpdate, 2000);
      return () => clearInterval(id);
    }

    const channel = supabase
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        onUpdate
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ordenes" },
        onUpdate
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_log" },
        onUpdate
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "eventos" },
        onUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
