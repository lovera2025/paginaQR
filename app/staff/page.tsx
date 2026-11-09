"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { IconCandado, IconFlecha } from "@/components/publico/iconos";
import { MARCA_ISOTIPO } from "@/components/publico/Marca";
import { destinoPermitido } from "@/lib/auth/destino";

type Rol = "admin" | "scanner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function MarcaStaff() {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MARCA_ISOTIPO} alt="Junior Eventos" width={34} height={36} />
      <span className="font-display text-[15px] tracking-[0.22em]">STAFF</span>
    </div>
  );
}

function PinPad({ onLogin, aviso }: { onLogin: (rol: Rol) => void; aviso: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [shake, setShake] = useState(0);

  const enviar = useCallback(
    async (valor: string) => {
      if (!valor || enviando) return;
      setEnviando(true);
      setError("");
      try {
        const res = await fetch("/api/auth/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: valor }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "PIN incorrecto");
          setPin("");
          setShake((s) => s + 1);
          if (navigator.vibrate) navigator.vibrate(200);
          return;
        }
        onLogin(data.role as Rol);
      } catch {
        setError("Sin conexión. Probá de nuevo.");
      } finally {
        setEnviando(false);
      }
    },
    [enviando, onLogin]
  );

  const tecla = (d: string) => {
    setError("");
    setPin((p) => (p.length < 12 ? p + d : p));
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^[0-9a-zA-Z]$/.test(e.key)) tecla(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter") enviar(pin);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pin, enviar]);

  const puntos = Math.max(6, pin.length);

  return (
    <div className="flex w-full max-w-[320px] flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-oro/50 bg-oro/[0.12] text-oro">
          <IconCandado size={24} />
        </span>
        <h1 className="mt-1 font-display text-[22px] font-extrabold">Login/Staff</h1>
        <p className="text-[13px] text-white/60">Ingresá tu PIN. Según el PIN entrás al panel o al scanner.</p>
      </div>

      {aviso && <p className="rounded-xl bg-amber-400/10 px-4 py-2.5 text-center text-xs text-amber-200">{aviso}</p>}

      <motion.div
        key={shake}
        animate={shake ? { x: [0, -10, 10, -8, 8, 0] } : undefined}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap justify-center gap-3"
        aria-label={`${pin.length} dígitos ingresados`}
      >
        {Array.from({ length: puntos }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full transition ${i < pin.length ? "bg-oro" : "border-2 border-white/30"}`}
          />
        ))}
      </motion.div>

      {error && (
        <p role="alert" className="-mt-2 text-sm font-semibold text-red-400">
          {error}
        </p>
      )}

      <div className="grid w-full grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => tecla(d)}
            className="h-[68px] rounded-[18px] border border-white/12 bg-white/[0.05] font-display text-2xl font-bold transition active:scale-95 active:bg-white/15"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          aria-label="Borrar"
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="h-[68px] rounded-[18px] border border-white/12 text-white/70 transition active:scale-95"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => tecla("0")}
          className="h-[68px] rounded-[18px] border border-white/12 bg-white/[0.05] font-display text-2xl font-bold transition active:scale-95 active:bg-white/15"
        >
          0
        </button>
        <button
          type="button"
          aria-label="Entrar"
          disabled={!pin || enviando}
          onClick={() => enviar(pin)}
          className="btn-oro h-[68px] rounded-[18px] text-base"
        >
          {enviando ? "…" : <IconFlecha size={22} />}
        </button>
      </div>
      <p className="text-[11px] text-white/40">La sesión dura 12 horas en este teléfono.</p>
    </div>
  );
}

function InstalarApp() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalada(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalada(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (instalada) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#25d366]/30 bg-[#25d366]/[0.08] p-4">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-semibold">Instalá la app en tu teléfono</span>
        <span className="text-[11px] leading-snug text-white/60">
          {prompt
            ? "Queda como ícono y abre directo acá, sin escribir nada."
            : ios
              ? "En Safari tocá Compartir y después “Agregar a inicio”."
              : "Desde el menú del navegador elegí “Instalar app” o “Agregar a la pantalla principal”."}
        </span>
      </div>
      {prompt && (
        <button
          type="button"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
          className="h-10 shrink-0 rounded-full bg-[#25d366] px-4 text-xs font-bold text-[#06240f]"
        >
          Instalar
        </button>
      )}
    </div>
  );
}

function Hub({ rol, onLogout }: { rol: Rol; onLogout: () => void }) {
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <MarcaStaff />
        <span className="rounded-full border border-oro/50 bg-oro/15 px-3 py-1.5 font-display text-[10px] font-extrabold tracking-[0.14em] text-oro-claro">
          {rol === "admin" ? "JEFE" : "PUERTA"}
        </span>
      </div>
      <div className="mt-2">
        <h1 className="font-display text-2xl font-extrabold">¿Qué querés abrir?</h1>
      </div>

      {rol === "admin" && (
        <Link
          href="/admin"
          className="flex items-center gap-4 rounded-[22px] border border-oro/50 bg-gradient-to-br from-oro/25 to-oro/[0.05] p-5 transition hover:border-oro"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-oro text-tinta">
            <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 19V9M10 19V5M16 19v-8M22 19H2" />
            </svg>
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="font-display text-lg font-extrabold">Panel</span>
            <span className="text-xs text-white/65">Fiestas, entradas y precios, ventas, pagos</span>
          </span>
          <IconFlecha className="text-oro" />
        </Link>
      )}

      <Link
        href="/scanner"
        className="flex items-center gap-4 rounded-[22px] border border-white/12 bg-white/[0.04] p-5 transition hover:border-white/30"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M3 12h18" />
          </svg>
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-display text-lg font-extrabold">Scanner</span>
          <span className="text-xs text-white/65">Validar entradas en la puerta</span>
        </span>
        <IconFlecha className="text-white/50" />
      </Link>

      <div className="mt-4 flex flex-col gap-3">
        <InstalarApp />
        <button
          type="button"
          onClick={onLogout}
          className="h-11 rounded-full border border-white/15 text-[13px] text-white/70 transition hover:text-white"
        >
          Cerrar sesión
        </button>
        <Link href="/" className="text-center text-xs text-white/40 hover:text-white/70">
          Ir a la página pública
        </Link>
      </div>
    </div>
  );
}

function StaffContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [rol, setRol] = useState<Rol | null | undefined>(undefined);
  const [aviso, setAviso] = useState(params.get("expirado") ? "Tu sesión venció. Ingresá de nuevo." : "");

  const entrar = useCallback(
    (r: Rol) => {
      const destino = destinoPermitido(next, r);
      if (destino) router.replace(destino);
      else setRol(r);
    },
    [next, router]
  );

  useEffect(() => {
    fetch("/api/auth/check", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.stale) setAviso("El PIN fue cambiado. Ingresá con el PIN nuevo.");
        if (d.role === "admin" || d.role === "scanner") entrar(d.role);
        else setRol(null);
      })
      .catch(() => setRol(null));
  }, [entrar]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setRol(null);
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-noche px-6 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_50%_0%,rgba(212,168,83,0.18),rgba(5,5,8,0)_60%)]" />
      <div className="relative flex w-full flex-col items-center gap-8">
        {rol === undefined ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-oro" />
        ) : rol === null ? (
          <>
            <MarcaStaff />
            <PinPad onLogin={entrar} aviso={aviso} />
          </>
        ) : (
          <Hub rol={rol} onLogout={logout} />
        )}
      </div>
    </main>
  );
}

export default function StaffPage() {
  return (
    <Suspense>
      <StaffContent />
    </Suspense>
  );
}
