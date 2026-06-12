"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import type { VerifyResult } from "@/types";

const SCANNER_ID = "qr-reader";

export function QRScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState("");
  const processing = useRef(false);

  useEffect(() => {
    let mounted = true;
    const scanner = new Html5Qrcode(SCANNER_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (processing.current) return;
          processing.current = true;

          try {
            await scanner.pause(true);
            setScanning(false);

            const res = await fetch(`/api/verificar/${decodedText}`, {
              method: "POST",
            });
            const data: VerifyResult = await res.json();
            if (mounted) setResult(data);
          } catch {
            if (mounted) setError("Error al verificar. Reintentá.");
          }
        },
        () => {}
      )
      .catch(() => {
        if (mounted) setError("No se pudo acceder a la cámara. Revisá permisos.");
      });

    return () => {
      mounted = false;
      scanner.stop().catch(() => {});
    };
  }, []);

  async function scanAgain() {
    setResult(null);
    setError("");
    setScanning(true);
    processing.current = false;
    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
      } catch {
        window.location.reload();
      }
    }
  }

  if (result) {
    const colors = {
      valido: "from-green-500 to-emerald-600",
      usada: "from-yellow-500 to-amber-600",
      cancelada: "from-red-600 to-rose-700",
      invalido: "from-red-600 to-rose-700",
    };
    const icons = { valido: "✅", usada: "⚠️", cancelada: "❌", invalido: "❌" };

    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center bg-gradient-to-b ${colors[result.status]} px-6`}
      >
        <p className="mb-2 text-6xl">{icons[result.status]}</p>
        <h1 className="mb-4 text-3xl font-black uppercase">
          {result.status === "valido"
            ? "Válido"
            : result.status === "usada"
              ? "Ya usada"
              : result.status === "cancelada"
                ? "Cancelada"
                : "Inválida"}
        </h1>
        {result.ticket && (
          <div className="mb-6 text-center">
            <p className="text-2xl font-bold">{result.ticket.compradorNombre}</p>
            <p className="text-white/80">{result.ticket.compradorEmail}</p>
            <p className="mt-2 text-lg">
              Entrada {result.ticket.numeroEntrada} de {result.ticket.totalEntradas}
            </p>
          </div>
        )}
        <p className="mb-8 text-center text-white/90">{result.message}</p>
        <button
          onClick={scanAgain}
          className="rounded-full bg-white px-8 py-4 font-bold text-black"
        >
          Escanear siguiente
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <div className="border-b border-white/10 px-4 py-4 text-center">
        <h1 className="text-lg font-bold">Scanner de entradas</h1>
        <p className="text-sm text-white/50">
          {scanning ? "Apuntá al QR del comprador" : "Verificando..."}
        </p>
      </div>

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-white px-6 py-3 font-semibold text-black"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div id={SCANNER_ID} className="w-full flex-1" />
      )}
    </div>
  );
}
