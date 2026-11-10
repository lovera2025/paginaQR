"use client";

import { useState } from "react";

export interface MpInfo {
  configured: boolean;
  hasToken: boolean;
  environment: "sandbox" | "production";
  enabled: boolean;
  webhookUrl: string;
}

interface Props {
  info: MpInfo;
  /** Vuelve a leer el estado de Pagos después de guardar. */
  onSaved: () => void;
  onToast: (type: "success" | "error", text: string) => void;
}

const PANEL_MP = "https://www.mercadopago.com.ar/developers/panel/app";

function Numero({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-oro/20 text-xs font-bold text-oro-claro">
      {n}
    </span>
  );
}

/** Conectar la cuenta de Mercado Pago en tres pasos, sin términos técnicos. */
export function ConectarMercadoPago({ info, onSaved, onToast }: Props) {
  const [clave, setClave] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  const esLocal = /localhost|127\.0\.0\.1/.test(info.webhookUrl);
  const conectada = info.configured && info.enabled;
  const estado = !info.hasToken
    ? { texto: "Falta conectar", clase: "bg-yellow-500/20 text-yellow-300" }
    : !info.enabled
      ? { texto: "Pausado", clase: "bg-white/10 text-white/60" }
      : info.environment === "sandbox"
        ? { texto: "Modo prueba", clase: "bg-amber-400/20 text-amber-300" }
        : { texto: "Cobros reales", clase: "bg-green-500/20 text-green-400" };

  async function guardar(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/admin/pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "mp", environment: "auto", ...body }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "No se pudo guardar");
      return false;
    }
    return true;
  }

  async function guardarYVerificar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResultado(null);
    if (!clave.trim() && !info.hasToken) {
      setError("Pegá la clave de Mercado Pago");
      return;
    }
    setGuardando(true);
    try {
      // Una clave nueva activa los cobros; solo verificar no cambia si están pausados.
      const cambio = clave.trim() ? { enabled: true, accessToken: clave.trim() } : { enabled: info.enabled };
      if (!(await guardar(cambio))) return;
      const res = await fetch("/api/admin/pagos/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "mp" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "No se pudo verificar la cuenta");
        return;
      }
      setResultado({ ok: !d.advertencia, texto: d.advertencia ?? d.message ?? "Cuenta conectada" });
      setClave("");
      onToast(d.advertencia ? "error" : "success", d.advertencia ?? d.message ?? "Cuenta conectada");
      onSaved();
    } finally {
      setGuardando(false);
    }
  }

  async function pausar(enabled: boolean) {
    if (!enabled && !confirm("¿Pausar los cobros con Mercado Pago? Nadie va a poder pagar con tarjeta hasta que los actives de nuevo.")) return;
    setError("");
    setGuardando(true);
    try {
      if (await guardar({ enabled })) {
        onToast("success", enabled ? "Cobros con Mercado Pago activados" : "Cobros con Mercado Pago pausados");
        onSaved();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(info.webhookUrl);
      onToast("success", "Dirección copiada");
    } catch {
      onToast("error", "No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  return (
    <form onSubmit={guardarYVerificar} className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold">Cobros con Mercado Pago</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estado.clase}`}>{estado.texto}</span>
      </div>
      <p className="mt-1 text-sm text-white/60">
        Los compradores pagan con tarjeta, débito o dinero en cuenta. La plata entra en la cuenta de Mercado Pago que
        conectes acá.
      </p>

      <ol className="mt-5 flex flex-col gap-5">
        <li className="flex gap-3">
          <Numero n={1} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Abrí Mercado Pago con la cuenta que va a cobrar</p>
            <p className="mt-0.5 text-xs text-white/55">
              En &quot;Tus integraciones&quot; elegí la aplicación (o creá una: nombre &quot;Junior Eventos&quot;, producto Checkout
              Pro). Arriba, en el selector, elegí <strong className="text-white/80">Producción</strong> y entrá a{" "}
              <strong className="text-white/80">Credenciales</strong>.
            </p>
            <a
              href={PANEL_MP}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex h-9 items-center rounded-lg border border-white/20 px-3.5 text-xs font-semibold hover:bg-white/5"
            >
              Abrir Mercado Pago ↗
            </a>
          </div>
        </li>
        <li className="flex gap-3">
          <Numero n={2} />
          <div className="min-w-0 flex-1">
            <label htmlFor="mp-clave" className="text-sm font-semibold">
              Copiá la clave de cobro y pegala acá
            </label>
            <p className="mt-0.5 text-xs text-white/55">
              En Mercado Pago se llama &quot;Access Token&quot; y empieza con APP_USR. Es privada: no la compartas por chat.
            </p>
            <input
              id="mp-clave"
              type="password"
              autoComplete="off"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder={info.hasToken ? "Ya hay una clave guardada. Pegá otra para reemplazarla" : "APP_USR-…"}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-oro/70"
            />
          </div>
        </li>
        <li className="flex gap-3">
          <Numero n={3} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Activá el aviso automático de pagos</p>
            <p className="mt-0.5 text-xs text-white/55">
              En Mercado Pago, menú <strong className="text-white/80">Webhooks → Configurar notificaciones</strong>: pegá
              esta dirección en &quot;URL modo producción&quot;, marcá el evento <strong className="text-white/80">Pagos</strong>{" "}
              y guardá. Así las entradas se entregan solas apenas se acredita el pago.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                aria-label="Dirección para el aviso de pagos"
                value={info.webhookUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-xs text-white/80 outline-none"
              />
              <button type="button" onClick={copiar} className="h-10 shrink-0 rounded-lg border border-white/20 px-3.5 text-xs font-semibold hover:bg-white/5">
                Copiar
              </button>
            </div>
            {esLocal && (
              <p className="mt-1.5 text-xs text-amber-300">
                Estás en la compu de prueba: esta dirección solo sirve desde la página publicada.
              </p>
            )}
          </div>
        </li>
      </ol>

      {resultado && (
        <p
          role="status"
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
            resultado.ok ? "border-green-500/20 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {resultado.texto}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" disabled={guardando} className="h-12 flex-1 rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50">
          {guardando ? "Verificando…" : info.hasToken && !clave.trim() ? "Verificar conexión" : "Guardar y verificar"}
        </button>
        {info.hasToken && (
          <button
            type="button"
            disabled={guardando}
            onClick={() => pausar(!info.enabled)}
            className="h-12 rounded-xl border border-white/20 px-4 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
          >
            {info.enabled ? "Pausar cobros" : "Activar cobros"}
          </button>
        )}
      </div>
      {conectada && info.environment === "sandbox" && (
        <p className="mt-3 text-xs text-amber-200/90">
          La clave guardada es de una cuenta de prueba: sirve para ensayar, no cobra de verdad. Para vender, pegá la
          clave de la cuenta real.
        </p>
      )}
    </form>
  );
}
