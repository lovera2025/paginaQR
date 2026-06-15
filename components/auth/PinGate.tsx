"use client";

import { useEffect, useState } from "react";
import type { AuthRole } from "@/lib/auth/cookies";

interface PinGateProps {
  role: AuthRole;
  title: string;
  children: React.ReactNode;
}

export function PinGate({ role, title, children }: PinGateProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((data) => {
        if (data.stale) {
          setInfoMessage("El PIN fue actualizado. Ingresá con el PIN nuevo.");
          setAuthorized(false);
          return;
        }
        if (role === "admin") setAuthorized(data.role === "admin");
        else setAuthorized(data.role === "scanner" || data.role === "admin");
      })
      .catch(() => setAuthorized(false));
  }, [role]);

  useEffect(() => {
    if (!authorized) return;
    const interval = setInterval(() => {
      fetch("/api/auth/check")
        .then((r) => r.json())
        .then((data) => {
          if (data.stale) {
            setInfoMessage("El PIN fue actualizado. Ingresá con el PIN nuevo.");
            setAuthorized(false);
            setPin("");
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [authorized]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    const res = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, role }),
    });
    if (!res.ok) {
      setError("PIN incorrecto");
      return;
    }
    setAuthorized(true);
  }

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md"
        >
          <h1 className="mb-2 text-2xl font-bold">{title}</h1>
          <p className="mb-6 text-sm text-white/60">Ingresá el PIN de acceso</p>
          {infoMessage && (
            <p className="mb-4 rounded-lg bg-yellow-500/10 px-4 py-3 text-center text-sm text-yellow-300">
              {infoMessage}
            </p>
          )}
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-2xl tracking-widest outline-none focus:border-white/30"
            autoFocus
          />
          {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-white py-3 font-semibold text-black transition hover:bg-white/90"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
