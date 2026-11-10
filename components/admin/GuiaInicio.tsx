"use client";

import { useCallback, useEffect, useState } from "react";

type TabDestino = "marca" | "seguridad" | "pagos" | "resumen";

interface Estado {
  whatsapp: boolean;
  pins: boolean;
  cobros: "real" | "prueba" | "sin";
  total: number;
  borrador: number;
  publicadas: number;
  enProximamente: number;
}

interface Props {
  /** Cambia cuando el panel se actualiza: vuelve a leer el estado. */
  version: number;
  onIr: (tab: TabDestino) => void;
  onCerrar: () => void;
  onToast: (type: "success" | "error", text: string) => void;
  onChanged: () => void;
}

const LS_PRECIOS = "admin.guiaPreciosRevisados";

function Paso({
  n,
  hecho,
  titulo,
  detalle,
  children,
}: {
  n: number;
  hecho: boolean;
  titulo: string;
  detalle: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3.5">
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          hecho ? "bg-green-500/20 text-green-300" : "bg-oro/20 text-oro-claro"
        }`}
      >
        {hecho ? "✓" : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${hecho ? "text-white/60" : "text-white"}`}>
            {titulo}
            {hecho && <span className="sr-only"> (listo)</span>}
          </p>
          <p className="text-xs text-white/55">{detalle}</p>
        </div>
        {children}
      </div>
    </li>
  );
}

const BTN = "h-9 shrink-0 rounded-lg border border-white/20 px-3.5 text-xs font-semibold hover:bg-white/5";

/** Pasos para dejar la venta funcionando. Cada uno se tilda solo según el estado real del sistema. */
export function GuiaInicio({ version, onIr, onCerrar, onToast, onChanged }: Props) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [preciosOk, setPreciosOk] = useState(false);
  const [abriendo, setAbriendo] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/admin/guia", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEstado(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  useEffect(() => {
    try {
      setPreciosOk(localStorage.getItem(LS_PRECIOS) === "1");
    } catch {
      /* sin storage */
    }
  }, []);

  function marcarPrecios() {
    setPreciosOk(true);
    try {
      localStorage.setItem(LS_PRECIOS, "1");
    } catch {
      /* ignore */
    }
  }

  async function abrirVenta() {
    if (!estado) return;
    if (!confirm(`¿Abrir la venta en ${estado.enProximamente === 1 ? "la fiesta publicada" : `las ${estado.enProximamente} fiestas publicadas`}? Desde ese momento se puede comprar.`)) return;
    setAbriendo(true);
    try {
      const res = await fetch("/api/admin/eventos/abrir-venta", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        onToast("error", d.error ?? "No se pudo abrir la venta");
        return;
      }
      onToast("success", `Venta abierta en ${d.abiertas} ${d.abiertas === 1 ? "fiesta" : "fiestas"}`);
      cargar();
      onChanged();
    } finally {
      setAbriendo(false);
    }
  }

  if (!estado) return null;

  const ventaAbierta = estado.publicadas > 0 && estado.enProximamente === 0;
  const hechos = [estado.whatsapp, estado.pins, estado.cobros === "real", preciosOk, ventaAbierta].filter(Boolean).length;

  return (
    <section className="mb-6 rounded-2xl border border-oro/30 bg-oro/[0.05] p-5" aria-label="Guía de puesta en marcha">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold">Puesta en marcha</h2>
          <p className="mt-0.5 text-sm text-white/60">
            {hechos === 5 ? "Todo listo: la venta está funcionando." : `${hechos} de 5 pasos listos. Seguí el orden y en minutos queda vendiendo.`}
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold text-white/75 hover:bg-white/5">
          Ocultar
        </button>
      </div>

      <ol className="mt-4 flex flex-col gap-2">
        <Paso n={1} hecho={estado.whatsapp} titulo="WhatsApp de contacto" detalle="Para que los compradores te escriban por dudas o anulaciones.">
          <button type="button" onClick={() => onIr("marca")} className={BTN}>
            {estado.whatsapp ? "Cambiar" : "Cargar número"}
          </button>
        </Paso>
        <Paso n={2} hecho={estado.pins} titulo="PIN propios" detalle="Uno para vos (panel completo) y otro para la puerta (solo validar entradas).">
          <button type="button" onClick={() => onIr("seguridad")} className={BTN}>
            {estado.pins ? "Cambiar" : "Elegir PIN"}
          </button>
        </Paso>
        <Paso
          n={3}
          hecho={estado.cobros === "real"}
          titulo="Mercado Pago"
          detalle={
            estado.cobros === "real"
              ? "Cuenta conectada: la plata de las ventas entra en esa cuenta."
              : estado.cobros === "prueba"
                ? "Está en modo prueba: todavía no se cobra de verdad."
                : "Conectá la cuenta que va a recibir la plata de las ventas."
          }
        >
          <button type="button" onClick={() => onIr("pagos")} className={BTN}>
            {estado.cobros === "real" ? "Ver" : "Conectar cuenta"}
          </button>
        </Paso>
        <Paso n={4} hecho={preciosOk} titulo="Precios y fechas" detalle="Revisá en Etapas de venta el precio de cada entrada y cuándo abre.">
          {preciosOk ? (
            <button type="button" onClick={() => onIr("resumen")} className={BTN}>
              Ver etapas
            </button>
          ) : (
            <button type="button" onClick={marcarPrecios} className={BTN}>
              Ya los revisé
            </button>
          )}
        </Paso>
        <Paso
          n={5}
          hecho={ventaAbierta}
          titulo="Abrir la venta"
          detalle={
            ventaAbierta
              ? `Venta abierta en ${estado.publicadas} ${estado.publicadas === 1 ? "fiesta" : "fiestas"}.`
              : estado.publicadas === 0
                ? "Publicá cada fiesta desde Resumen (botón Publicar) para que aparezca en la página."
                : estado.cobros !== "real"
                  ? `${estado.enProximamente} ${estado.enProximamente === 1 ? "fiesta publicada" : "fiestas publicadas"} en Próximamente. Se habilita al conectar Mercado Pago.`
                  : `${estado.enProximamente} ${estado.enProximamente === 1 ? "fiesta publicada" : "fiestas publicadas"} en Próximamente, listas para vender.`
          }
        >
          {!ventaAbierta && estado.enProximamente > 0 && (
            <button
              type="button"
              onClick={abrirVenta}
              disabled={abriendo || estado.cobros !== "real"}
              className="h-9 shrink-0 rounded-lg bg-green-600 px-3.5 text-xs font-bold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {abriendo ? "Abriendo…" : "Abrir la venta"}
            </button>
          )}
        </Paso>
      </ol>

      <details className="mt-4 text-sm text-white/70">
        <summary className="cursor-pointer text-xs font-semibold text-white/60">Qué hay en cada pestaña</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-white/60">
          <li><strong className="text-white/80">Resumen:</strong> ventas del día y etapas de cada fiesta.</li>
          <li><strong className="text-white/80">Entradas y precios:</strong> cupos, diseño y tipos de entrada nuevos.</li>
          <li><strong className="text-white/80">Compras:</strong> quién compró, bajar su PDF, anular y devolver.</li>
          <li><strong className="text-white/80">Fiesta y Marca:</strong> flyer, fecha, lugar y datos de contacto.</li>
          <li><strong className="text-white/80">Scanner</strong> (arriba a la derecha): validar entradas en la puerta.</li>
        </ul>
      </details>
    </section>
  );
}
