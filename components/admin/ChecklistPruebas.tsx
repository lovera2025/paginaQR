"use client";

import { useEffect, useState } from "react";

const LS = "admin.checklistPruebas";

/** Pasos para probar el sistema de punta a punta antes de lanzar. Se recuerda en este teléfono. */
const PASOS = [
  "Pagos en Prueba: la página muestra MODO PRUEBA arriba",
  "Comprar 1 Anticipada con tarjeta APRO → vuelve solo y aparecen las entradas con QR",
  "Antes de aprobar el pago no se ve ninguna entrada (solo \"Esperando confirmación\")",
  "Descargar el PDF de la compra: una página por entrada, con el QR",
  "Llega el mail [PRUEBA] con las entradas y el botón de descarga",
  "Scanner: el QR da verde la primera vez y amarillo (ya ingresó) la segunda",
  "Comprar con tarjeta OTHE → pago rechazado, sin entradas",
  "Comprar 3 VIP, anular 1 desde Compras → esa da rojo en la puerta y el PDF trae 2",
  "Actividad muestra \"MP … → aprobado\" (el aviso de Mercado Pago llegó)",
  "Reiniciar ventas en cada fiesta y pasar Mercado Pago a Producción",
];

export function ChecklistPruebas() {
  const [hechos, setHechos] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) setHechos(JSON.parse(raw));
    } catch {
      /* sin storage: arranca vacío */
    }
  }, []);

  function toggle(i: number) {
    setHechos((xs) => {
      const next = xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i];
      try {
        localStorage.setItem(LS, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <details className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <summary className="cursor-pointer text-base font-bold">
        Checklist antes de lanzar ({hechos.length}/{PASOS.length})
      </summary>
      <div className="mt-3 flex flex-col gap-1.5">
        {PASOS.map((paso, i) => (
          <label key={paso} className="flex min-h-[40px] cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]">
            <input type="checkbox" checked={hechos.includes(i)} onChange={() => toggle(i)} className="mt-0.5 h-4 w-4 accent-green-500" />
            <span className={hechos.includes(i) ? "text-white/40 line-through" : "text-white/80"}>{paso}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
