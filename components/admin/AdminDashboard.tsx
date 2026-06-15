"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import type {
  ActivityLog,
  AdminStats,
  Evento,
  HistorialItem,
  Orden,
  Ticket,
} from "@/types";
import {
  canAbrirVenta,
  canCerrarEvento,
  canResetVentas,
  EVENTO_ESTADO_LABELS,
} from "@/lib/evento/estado";
import {
  formatFecha,
  formatFechaCorta,
  formatPrecio,
  isoToDatetimeLocalAr,
  ticketEstadoLabel,
} from "@/lib/utils";

type Tab = "resumen" | "compras" | "entradas" | "apariencia" | "actividad" | "historial" | "pagos" | "seguridad";
type Toast = { type: "success" | "error"; text: string };

interface SecurityInfo {
  adminPinDebil: boolean;
  scannerPinDebil: boolean;
  ambosIguales: boolean;
}

interface TaloPagosInfo {
  configured: boolean;
  hasSecret: boolean;
  userId: string;
  clientId: string;
  environment: "sandbox" | "production";
  enabled: boolean;
  storedInDb: boolean;
  webhookUrl: string;
}

interface MpPagosInfo {
  configured: boolean;
  hasToken: boolean;
  environment: "sandbox" | "production";
  enabled: boolean;
  storedInDb: boolean;
  webhookUrl: string;
}

interface PagosInfo {
  talo: TaloPagosInfo;
  mp: MpPagosInfo;
}

interface HistorialDetalle {
  ordenes: Orden[];
  tickets: Ticket[];
}

function estadoBadgeClass(estado: Evento["estado"]): string {
  if (estado === "borrador") return "bg-yellow-500/20 text-yellow-300";
  if (estado === "venta") return "bg-green-500/20 text-green-400";
  return "bg-white/10 text-white/50";
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-white/60">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
        />
      )}
    </div>
  );
}

const EMPTY_NUEVO = {
  nombre: "",
  fecha: "",
  precio: "",
  capacidad: "",
  copiarBranding: true,
};

const EMPTY_PAGOS_TALO_FORM = {
  userId: "",
  clientId: "",
  clientSecret: "",
  environment: "production" as "sandbox" | "production",
  enabled: true,
};

const EMPTY_PAGOS_MP_FORM = {
  accessToken: "",
  environment: "production" as "sandbox" | "production",
  enabled: true,
};

const EMPTY_PIN_FORM = {
  pinActual: "",
  pinAdminNuevo: "",
  pinScannerNuevo: "",
  pinAdminConfirm: "",
  pinScannerConfirm: "",
};

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("resumen");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");

  // Nuevo evento
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoForm, setNuevoForm] = useState(EMPTY_NUEVO);
  const [nuevoLoading, setNuevoLoading] = useState(false);
  const [nuevoError, setNuevoError] = useState("");

  // Historial
  const [historialItems, setHistorialItems] = useState<HistorialItem[] | null>(null);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [selectedHistorialId, setSelectedHistorialId] = useState<string | null>(null);
  const [historialDetalle, setHistorialDetalle] = useState<HistorialDetalle | null>(null);
  const [historialDetalleLoading, setHistorialDetalleLoading] = useState(false);

  // Seguridad
  const [security, setSecurity] = useState<SecurityInfo | null>(null);
  const [pinChangeOpen, setPinChangeOpen] = useState(false);
  const [pinForm, setPinForm] = useState(EMPTY_PIN_FORM);
  const [pinChangeLoading, setPinChangeLoading] = useState(false);
  const [pinChangeError, setPinChangeError] = useState("");

  // Pagos (Talo + Mercado Pago)
  const [pagosInfo, setPagosInfo] = useState<PagosInfo | null>(null);
  const [pagosTaloForm, setPagosTaloForm] = useState(EMPTY_PAGOS_TALO_FORM);
  const [pagosMpForm, setPagosMpForm] = useState(EMPTY_PAGOS_MP_FORM);
  const [pagosTaloLoading, setPagosTaloLoading] = useState(false);
  const [pagosMpLoading, setPagosMpLoading] = useState(false);
  const [pagosTaloTestLoading, setPagosTaloTestLoading] = useState(false);
  const [pagosMpTestLoading, setPagosMpTestLoading] = useState(false);
  const [pagosTaloError, setPagosTaloError] = useState("");
  const [pagosMpError, setPagosMpError] = useState("");
  const [pagosTaloTestOk, setPagosTaloTestOk] = useState<boolean | null>(null);
  const [pagosMpTestOk, setPagosMpTestOk] = useState<boolean | null>(null);

  function showToast(type: Toast["type"], text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  const refresh = useCallback(async () => {
    const [s, o, t, a, e] = await Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/ordenes").then((r) => r.json()),
      fetch("/api/admin/tickets").then((r) => r.json()),
      fetch("/api/admin/activity").then((r) => r.json()),
      fetch("/api/admin/evento").then((r) => r.json()),
    ]);
    setStats(s);
    setOrdenes(o.ordenes ?? []);
    setTickets(t.tickets ?? []);
    setActivity(a.activity ?? []);
    setEvento(e?.id ? { ...e, estado: e.estado ?? "borrador" } : null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useAdminRealtime(refresh);

  useEffect(() => {
    const checkSession = () => {
      fetch("/api/auth/check")
        .then((r) => r.json())
        .then((d) => {
          if (d.stale) window.location.reload();
        })
        .catch(() => {});
    };
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cargar historial cuando se abre la pestaña
  useEffect(() => {
    if (tab !== "historial" || historialItems !== null) return;
    setHistorialLoading(true);
    fetch("/api/admin/historial")
      .then((r) => r.json())
      .then((d) => setHistorialItems(d.items ?? []))
      .finally(() => setHistorialLoading(false));
  }, [tab, historialItems]);

  // Cargar seguridad cuando se abre la pestaña
  useEffect(() => {
    if (tab !== "seguridad" || security !== null) return;
    fetch("/api/admin/security-check")
      .then((r) => r.json())
      .then((d) => setSecurity(d));
  }, [tab, security]);

  // Cargar pagos cuando se abre la pestaña
  useEffect(() => {
    if (tab !== "pagos" || pagosInfo !== null) return;
    fetch("/api/admin/pagos")
      .then((r) => r.json())
      .then((d) => {
        setPagosInfo(d);
        setPagosTaloForm({
          userId: d.talo?.userId ?? "",
          clientId: d.talo?.clientId ?? "",
          clientSecret: "",
          environment: d.talo?.environment === "sandbox" ? "sandbox" : "production",
          enabled: d.talo?.enabled !== false,
        });
        setPagosMpForm({
          accessToken: "",
          environment: d.mp?.environment === "sandbox" ? "sandbox" : "production",
          enabled: d.mp?.enabled !== false,
        });
      });
  }, [tab, pagosInfo]);

  async function loadHistorialDetalle(eventoId: string) {
    if (selectedHistorialId === eventoId) {
      setSelectedHistorialId(null);
      setHistorialDetalle(null);
      return;
    }
    setSelectedHistorialId(eventoId);
    setHistorialDetalle(null);
    setHistorialDetalleLoading(true);
    try {
      const r = await fetch(`/api/admin/historial/${eventoId}`);
      const d = await r.json();
      setHistorialDetalle({ ordenes: d.ordenes ?? [], tickets: d.tickets ?? [] });
    } finally {
      setHistorialDetalleLoading(false);
    }
  }

  async function handleCancel(ticketId: string) {
    if (!confirm("¿Dar de baja esta entrada?")) return;
    setActionLoading(ticketId);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: "Baja manual admin" }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "No se pudo dar de baja");
        return;
      }
      showToast("success", "Entrada dada de baja");
      refresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefund(ordenId: string) {
    if (!confirm("¿Marcar orden como reembolsada y cancelar todas sus entradas?")) return;
    setActionLoading(ordenId);
    try {
      const res = await fetch(`/api/admin/ordenes/${ordenId}/refund`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "No se pudo reembolsar");
        return;
      }
      showToast("success", "Reembolso aplicado — entradas canceladas");
      refresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function persistEvento(updated: Evento, successMsg?: string) {
    const res = await fetch("/api/admin/evento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      const data = await res.json();
      showToast("error", data.error ?? "No se pudo guardar");
      return false;
    }
    if (successMsg) showToast("success", successMsg);
    refresh();
    return true;
  }

  async function handleImageUploaded(field: "logoUrl" | "flyerUrl", url: string) {
    if (!evento) return;
    const updated = { ...evento, [field]: url };
    setEvento(updated);
    const label = field === "logoUrl" ? "Logo actualizado" : "Flyer actualizado";
    await persistEvento(updated, label);
  }

  async function handleSaveEvento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!evento) return;
    setSaving(true);
    await persistEvento(evento, "Cambios guardados");
    setSaving(false);
  }

  async function handleResetVentas() {
    if (resetConfirm !== "REINICIAR") {
      showToast("error", "Escribí REINICIAR para confirmar");
      return;
    }
    setActionLoading("reset");
    try {
      const res = await fetch("/api/admin/reset-ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacion: resetConfirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "No se pudo reiniciar");
        return;
      }
      setResetOpen(false);
      setResetConfirm("");
      showToast("success", "Ventas reiniciadas — contadores en cero");
      refresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEstadoAccion(accion: "abrir_venta" | "cerrar") {
    const msg =
      accion === "abrir_venta"
        ? "¿Abrir venta pública? No vas a poder reiniciar ventas después."
        : "¿Cerrar y archivar este evento? Los datos se guardarán en Historial.";
    if (!confirm(msg)) return;

    setActionLoading(accion);
    try {
      const res = await fetch("/api/admin/evento/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "No se pudo actualizar el estado");
        return;
      }
      showToast(
        "success",
        accion === "abrir_venta"
          ? "Venta abierta"
          : "Evento cerrado y archivado en Historial"
      );
      // Resetear historial cargado para que se recargue
      setHistorialItems(null);
      refresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCrearNuevo(e: React.FormEvent) {
    e.preventDefault();
    setNuevoError("");
    if (!nuevoForm.nombre.trim()) { setNuevoError("El nombre es obligatorio"); return; }
    if (!nuevoForm.fecha) { setNuevoError("La fecha es obligatoria"); return; }
    if (!(Number(nuevoForm.precio) > 0)) { setNuevoError("El precio debe ser mayor a 0"); return; }
    if (!(Number(nuevoForm.capacidad) >= 1)) { setNuevoError("La capacidad debe ser al menos 1"); return; }

    setNuevoLoading(true);
    try {
      const res = await fetch("/api/admin/evento/nuevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevoForm.nombre.trim(),
          fecha: nuevoForm.fecha ? `${nuevoForm.fecha}:00-03:00` : "",
          precio: Number(nuevoForm.precio),
          capacidad: Number(nuevoForm.capacidad),
          copiarBranding: nuevoForm.copiarBranding,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNuevoError(data.error ?? "No se pudo crear el evento");
        return;
      }
      setNuevoOpen(false);
      setNuevoForm(EMPTY_NUEVO);
      showToast("success", `Evento "${data.evento.nombre}" creado en borrador`);
      setHistorialItems(null);
      refresh();
    } finally {
      setNuevoLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function handleSaveTaloPagos(e: React.FormEvent) {
    e.preventDefault();
    setPagosTaloError("");
    setPagosTaloTestOk(null);

    if (!pagosTaloForm.userId.trim() || !pagosTaloForm.clientId.trim()) {
      setPagosTaloError("Completá User ID y Client ID");
      return;
    }

    if (!pagosTaloForm.clientSecret.trim() && !pagosInfo?.talo.hasSecret) {
      setPagosTaloError("Ingresá el Client Secret");
      return;
    }

    setPagosTaloLoading(true);
    try {
      const payload: Record<string, string | boolean> = {
        provider: "talo",
        userId: pagosTaloForm.userId.trim(),
        clientId: pagosTaloForm.clientId.trim(),
        environment: pagosTaloForm.environment,
        enabled: pagosTaloForm.enabled,
      };
      if (pagosTaloForm.clientSecret.trim()) {
        payload.clientSecret = pagosTaloForm.clientSecret.trim();
      }

      const res = await fetch("/api/admin/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setPagosTaloError(data.error ?? "No se pudieron guardar las credenciales");
        return;
      }

      showToast("success", "Credenciales de Talo guardadas");
      setPagosInfo(null);
      setPagosTaloForm((f) => ({ ...f, clientSecret: "" }));
    } finally {
      setPagosTaloLoading(false);
    }
  }

  async function handleSaveMpPagos(e: React.FormEvent) {
    e.preventDefault();
    setPagosMpError("");
    setPagosMpTestOk(null);

    if (!pagosMpForm.accessToken.trim() && !pagosInfo?.mp.hasToken) {
      setPagosMpError("Ingresá el Access Token");
      return;
    }

    setPagosMpLoading(true);
    try {
      const payload: Record<string, string | boolean> = {
        provider: "mp",
        environment: pagosMpForm.environment,
        enabled: pagosMpForm.enabled,
      };
      if (pagosMpForm.accessToken.trim()) {
        payload.accessToken = pagosMpForm.accessToken.trim();
      }

      const res = await fetch("/api/admin/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setPagosMpError(data.error ?? "No se pudieron guardar las credenciales");
        return;
      }

      showToast("success", "Credenciales de Mercado Pago guardadas");
      setPagosInfo(null);
      setPagosMpForm((f) => ({ ...f, accessToken: "" }));
    } finally {
      setPagosMpLoading(false);
    }
  }

  async function handleTestTaloPagos() {
    setPagosTaloError("");
    setPagosTaloTestOk(null);
    setPagosTaloTestLoading(true);
    try {
      const res = await fetch("/api/admin/pagos/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "talo" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPagosTaloError(data.error ?? "No se pudo conectar con Talo");
        setPagosTaloTestOk(false);
        return;
      }
      setPagosTaloTestOk(true);
      showToast("success", data.message ?? "Conexión OK");
    } finally {
      setPagosTaloTestLoading(false);
    }
  }

  async function handleTestMpPagos() {
    setPagosMpError("");
    setPagosMpTestOk(null);
    setPagosMpTestLoading(true);
    try {
      const res = await fetch("/api/admin/pagos/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "mp" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPagosMpError(data.error ?? "No se pudo conectar con Mercado Pago");
        setPagosMpTestOk(false);
        return;
      }
      setPagosMpTestOk(true);
      showToast("success", data.message ?? "Conexión OK");
    } finally {
      setPagosMpTestLoading(false);
    }
  }

  async function handleChangePins(e: React.FormEvent) {
    e.preventDefault();
    setPinChangeError("");

    if (!pinForm.pinActual) {
      setPinChangeError("Ingresá tu PIN admin actual");
      return;
    }
    if (pinForm.pinAdminNuevo.length < 6) {
      setPinChangeError("El PIN admin nuevo debe tener al menos 6 caracteres");
      return;
    }
    if (pinForm.pinScannerNuevo.length < 6) {
      setPinChangeError("El PIN scanner nuevo debe tener al menos 6 caracteres");
      return;
    }
    if (pinForm.pinAdminNuevo === pinForm.pinScannerNuevo) {
      setPinChangeError("El PIN admin y el scanner deben ser distintos");
      return;
    }
    if (pinForm.pinAdminNuevo !== pinForm.pinAdminConfirm) {
      setPinChangeError("La confirmación del PIN admin no coincide");
      return;
    }
    if (pinForm.pinScannerNuevo !== pinForm.pinScannerConfirm) {
      setPinChangeError("La confirmación del PIN scanner no coincide");
      return;
    }

    setPinChangeLoading(true);
    try {
      const res = await fetch("/api/admin/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pinActual: pinForm.pinActual,
          pinAdminNuevo: pinForm.pinAdminNuevo,
          pinScannerNuevo: pinForm.pinScannerNuevo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinChangeError(data.error ?? "No se pudieron actualizar los PINs");
        return;
      }
      window.location.reload();
    } finally {
      setPinChangeLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "compras", label: "Compras" },
    { id: "entradas", label: "Entradas" },
    { id: "apariencia", label: "Apariencia" },
    { id: "actividad", label: "Actividad" },
    { id: "historial", label: "Historial" },
    { id: "pagos", label: "Pagos" },
    { id: "seguridad", label: "Seguridad" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin</h1>
            <p className="text-xs text-white/40">Actualización en vivo</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/scanner"
              target="_blank"
              className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
            >
              Scanner
            </a>
            <a
              href="/"
              target="_blank"
              className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
            >
              Ver web
            </a>
            <button
              onClick={logout}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-white/10 px-4">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-white text-black" : "text-white/60 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {toast && (
          <p
            className={`mb-6 rounded-lg px-4 py-3 text-sm ${
              toast.type === "success"
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {toast.text}
          </p>
        )}

        {/* ── RESUMEN ────────────────────────────────────── */}
        {tab === "resumen" && (
          <>
            {evento ? (
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/50">Estado del evento</p>
                    <p className="mt-1 text-lg font-bold">{evento.nombre}</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${estadoBadgeClass(evento.estado)}`}
                    >
                      {EVENTO_ESTADO_LABELS[evento.estado]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canResetVentas(evento.estado) && (
                      <button
                        type="button"
                        onClick={() => setResetOpen(true)}
                        disabled={actionLoading === "reset"}
                        className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        Reiniciar ventas
                      </button>
                    )}
                    {canAbrirVenta(evento.estado) && (
                      <button
                        type="button"
                        onClick={() => handleEstadoAccion("abrir_venta")}
                        disabled={actionLoading === "abrir_venta"}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        {actionLoading === "abrir_venta" ? "..." : "Abrir venta pública"}
                      </button>
                    )}
                    {canCerrarEvento(evento.estado) && (
                      <button
                        type="button"
                        onClick={() => handleEstadoAccion("cerrar")}
                        disabled={actionLoading === "cerrar"}
                        className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
                      >
                        {actionLoading === "cerrar" ? "..." : "Cerrar evento"}
                      </button>
                    )}
                  </div>
                </div>
                {evento.estado === "borrador" && (
                  <p className="mt-4 text-xs text-white/40">
                    Modo prueba: podés reiniciar ventas para limpiar compras de test.
                    Al abrir venta pública, reiniciar queda bloqueado.
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="mb-4 text-white/60">
                  No hay evento activo. Los datos del último evento están en{" "}
                  <button
                    className="underline hover:text-white"
                    onClick={() => setTab("historial")}
                  >
                    Historial
                  </button>
                  .
                </p>
                <button
                  onClick={() => setNuevoOpen(true)}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90"
                >
                  + Crear nuevo evento
                </button>
              </div>
            )}

            {/* Modal reiniciar */}
            {resetOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#12121a] p-6">
                  <h2 className="text-lg font-bold text-red-400">Reiniciar ventas</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Borra todas las compras y entradas de prueba de este evento.
                    No archiva en historial. Los QRs viejos dejan de funcionar.
                  </p>
                  <p className="mt-4 text-sm text-white/80">
                    Escribí <strong className="text-white">REINICIAR</strong> para confirmar:
                  </p>
                  <input
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                    placeholder="REINICIAR"
                    autoFocus
                  />
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setResetOpen(false); setResetConfirm(""); }}
                      className="flex-1 rounded-xl border border-white/10 py-3 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleResetVentas}
                      disabled={actionLoading === "reset"}
                      className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {actionLoading === "reset" ? "..." : "Confirmar"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal nuevo evento */}
            {nuevoOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-6">
                  <h2 className="mb-4 text-lg font-bold">Nuevo evento</h2>
                  <form onSubmit={handleCrearNuevo} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Nombre del evento</label>
                      <input
                        value={nuevoForm.nombre}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, nombre: e.target.value })}
                        placeholder="Ej: Fiesta de Promo 2027"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Fecha y hora</label>
                      <input
                        type="datetime-local"
                        value={nuevoForm.fecha}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, fecha: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none [color-scheme:dark]"
                      />
                      <p className="mt-1 text-xs text-white/40">Hora Argentina (ej. 20:00)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-white/60">Precio ($)</label>
                        <input
                          type="number"
                          min="1"
                          value={nuevoForm.precio}
                          onChange={(e) => setNuevoForm({ ...nuevoForm, precio: e.target.value })}
                          placeholder="15000"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-white/60">Capacidad</label>
                        <input
                          type="number"
                          min="1"
                          value={nuevoForm.capacidad}
                          onChange={(e) => setNuevoForm({ ...nuevoForm, capacidad: e.target.value })}
                          placeholder="300"
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                        />
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={nuevoForm.copiarBranding}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, copiarBranding: e.target.checked })}
                        className="h-4 w-4 accent-white"
                      />
                      <span className="text-sm text-white/80">
                        Copiar logo, flyer y contacto del evento anterior
                      </span>
                    </label>
                    {nuevoError && (
                      <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {nuevoError}
                      </p>
                    )}
                    <p className="text-xs text-white/40">
                      Se crea en borrador — podés editar el resto en Apariencia antes de abrir venta.
                    </p>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { setNuevoOpen(false); setNuevoForm(EMPTY_NUEVO); setNuevoError(""); }}
                        className="flex-1 rounded-xl border border-white/10 py-3 text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={nuevoLoading}
                        className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
                      >
                        {nuevoLoading ? "Creando..." : "Crear evento"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {stats && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Vendidas activas", value: stats.vendidasActivas, color: "#ff006e" },
                  { label: "Recaudado", value: formatPrecio(stats.recaudado), color: "#8338ec" },
                  { label: "Sin usar", value: stats.sinUsar, color: "#3a86ff" },
                  { label: "Ya ingresaron", value: stats.ingresaron, color: "#06d6a0" },
                  { label: "Canceladas", value: stats.canceladas, color: "#ef476f" },
                  { label: "Reembolsado", value: formatPrecio(stats.reembolsado), color: "#ffd166" },
                  { label: "Capacidad", value: `${stats.vendidasActivas} / ${stats.capacidad}`, color: "#fff" },
                  { label: "Disponibles", value: stats.disponibles, color: "#4cc9f0" },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-white/50">{card.label}</p>
                    <p className="text-2xl font-black" style={{ color: card.color }}>
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── COMPRAS ────────────────────────────────────── */}
        {tab === "compras" && (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Comprador</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Cant.</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id} className="border-b border-white/5">
                    <td className="p-3 text-white/60">{formatFechaCorta(o.createdAt)}</td>
                    <td className="p-3">{o.compradorNombre}</td>
                    <td className="p-3 text-white/60">{o.compradorEmail}</td>
                    <td className="p-3">{o.cantidad}</td>
                    <td className="p-3">{formatPrecio(o.montoTotal)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          o.estado === "aprobado"
                            ? "bg-green-500/20 text-green-400"
                            : o.estado === "reembolsado"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : o.estado === "pendiente"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {o.estado}
                      </span>
                    </td>
                    <td className="p-3">
                      {o.estado === "aprobado" && (
                        <button
                          onClick={() => handleRefund(o.id)}
                          disabled={actionLoading === o.id}
                          className="text-xs text-red-400 hover:underline disabled:opacity-50"
                        >
                          {actionLoading === o.id ? "..." : "Reembolsar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {ordenes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-white/40">
                      Sin compras aún
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ENTRADAS ────────────────────────────────────── */}
        {tab === "entradas" && (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Comprador</th>
                  <th className="p-3">Entrada</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Ingreso</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b border-white/5">
                    <td className="p-3 font-mono text-xs text-white/40">{t.id.slice(0, 8)}…</td>
                    <td className="p-3">{t.compradorNombre}</td>
                    <td className="p-3">{t.numeroEntrada}/{t.totalEntradas}</td>
                    <td className="p-3">{ticketEstadoLabel(t)}</td>
                    <td className="p-3 text-white/60">
                      {t.usadoAt ? formatFechaCorta(t.usadoAt) : "—"}
                    </td>
                    <td className="p-3">
                      {!t.cancelado && !t.usado && (
                        <button
                          onClick={() => handleCancel(t.id)}
                          disabled={actionLoading === t.id}
                          className="text-xs text-red-400 hover:underline disabled:opacity-50"
                        >
                          {actionLoading === t.id ? "..." : "Dar de baja"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/40">
                      Sin entradas aún
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── APARIENCIA ────────────────────────────────────── */}
        {tab === "apariencia" && evento && (
          <form onSubmit={handleSaveEvento} className="max-w-2xl space-y-4">
            <Field
              label="Nombre del evento"
              value={evento.nombre}
              onChange={(v) => setEvento({ ...evento, nombre: v })}
            />
            <div>
              <label className="mb-1 block text-sm text-white/60">Fecha y hora del evento</label>
              <input
                type="datetime-local"
                value={isoToDatetimeLocalAr(evento.fecha)}
                onChange={(e) =>
                  setEvento({
                    ...evento,
                    fecha: e.target.value ? `${e.target.value}:00-03:00` : evento.fecha,
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none [color-scheme:dark]"
              />
              <p className="mt-1 text-xs text-white/40">Hora Argentina (24 h, ej. 20:00)</p>
            </div>
            <ImageUploadField
              label="Flyer (hero)"
              kind="flyer"
              eventoId={evento.id}
              value={evento.flyerUrl}
              onChange={(url) => handleImageUploaded("flyerUrl", url)}
              onError={(m) => showToast("error", m)}
              previewClassName="h-48 w-full"
            />
            <ImageUploadField
              label="Logo"
              kind="logo"
              eventoId={evento.id}
              value={evento.logoUrl}
              onChange={(url) => handleImageUploaded("logoUrl", url)}
              onError={(m) => showToast("error", m)}
              previewClassName="h-24 w-24"
            />
            <Field label="Color primario (#hex)" value={evento.colorPrimario} onChange={(v) => setEvento({ ...evento, colorPrimario: v })} />
            <Field label="Color secundario (#hex)" value={evento.colorSecundario} onChange={(v) => setEvento({ ...evento, colorSecundario: v })} />
            <Field label="Descripción" value={evento.descripcion} onChange={(v) => setEvento({ ...evento, descripcion: v })} multiline />
            <Field label="Lugar" value={evento.lugar} onChange={(v) => setEvento({ ...evento, lugar: v })} />
            <Field label="Google Maps (URL)" value={evento.mapsUrl} onChange={(v) => setEvento({ ...evento, mapsUrl: v })} />
            <Field label="WhatsApp (54911...)" value={evento.contactoWhatsapp} onChange={(v) => setEvento({ ...evento, contactoWhatsapp: v })} />
            <Field label="Email contacto" value={evento.contactoEmail} onChange={(v) => setEvento({ ...evento, contactoEmail: v })} />
            <Field label="Instagram (@usuario)" value={evento.contactoInstagram} onChange={(v) => setEvento({ ...evento, contactoInstagram: v })} />
            <Field label="Texto footer" value={evento.textoFooter} onChange={(v) => setEvento({ ...evento, textoFooter: v })} multiline />
            <Field label="Organizador" value={evento.organizadorNombre} onChange={(v) => setEvento({ ...evento, organizadorNombre: v })} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-white/60">Precio</label>
                <input
                  type="number"
                  value={evento.precio}
                  onChange={(e) => setEvento({ ...evento, precio: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/60">Capacidad</label>
                <input
                  type="number"
                  value={evento.capacidad}
                  onChange={(e) => setEvento({ ...evento, capacidad: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-black disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        )}
        {tab === "apariencia" && !evento && (
          <div className="text-white/40">
            No hay evento activo para editar.{" "}
            <button className="underline" onClick={() => setTab("resumen")}>
              Ir a Resumen
            </button>
          </div>
        )}

        {/* ── ACTIVIDAD ────────────────────────────────────── */}
        {tab === "actividad" && (
          <div className="space-y-2">
            {activity.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <span className="text-xs text-white/40">{formatFechaCorta(a.createdAt)}</span>
                <span className="text-sm">{a.mensaje}</span>
              </div>
            ))}
            {activity.length === 0 && (
              <p className="text-center text-white/40">Sin actividad aún</p>
            )}
          </div>
        )}

        {/* ── HISTORIAL ────────────────────────────────────── */}
        {tab === "historial" && (
          <div className="space-y-4">
            {historialLoading && (
              <p className="text-center text-white/40">Cargando historial…</p>
            )}

            {!historialLoading && historialItems?.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/40">
                <p className="text-lg">Sin eventos archivados aún</p>
                <p className="mt-1 text-sm">Cuando cierres un evento, aparecerá aquí.</p>
              </div>
            )}

            {historialItems?.map((item) => {
              const expanded = selectedHistorialId === item.evento.id;
              return (
                <div
                  key={item.evento.id}
                  className="rounded-2xl border border-white/10 bg-white/5"
                >
                  {/* Cabecera del evento */}
                  <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div>
                      <p className="font-bold">{item.evento.nombre}</p>
                      <p className="mt-1 text-sm text-white/50">{formatFecha(item.evento.fecha)}</p>
                      <span className="mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">
                        Finalizado
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-center text-sm">
                      <div>
                        <p className="text-2xl font-black text-[#ff006e]">{item.stats.vendidasActivas}</p>
                        <p className="text-xs text-white/50">vendidas</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-[#8338ec]">{formatPrecio(item.stats.recaudado)}</p>
                        <p className="text-xs text-white/50">recaudado</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-[#06d6a0]">{item.stats.ingresaron}</p>
                        <p className="text-xs text-white/50">ingresaron</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black">{item.stats.sinUsar}</p>
                        <p className="text-xs text-white/50">sin usar</p>
                      </div>
                    </div>
                    <button
                      onClick={() => loadHistorialDetalle(item.evento.id)}
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                    >
                      {expanded ? "Ocultar detalle" : "Ver detalle"}
                    </button>
                  </div>

                  {/* Detalle expandible */}
                  {expanded && (
                    <div className="border-t border-white/10 p-5">
                      {historialDetalleLoading && (
                        <p className="text-center text-white/40">Cargando…</p>
                      )}
                      {historialDetalle && (
                        <div className="space-y-6">
                          {/* Stats completos */}
                          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            {[
                              { label: "Capacidad", value: item.stats.capacidad },
                              { label: "Vendidas", value: item.stats.vendidasActivas },
                              { label: "Ingresaron", value: item.stats.ingresaron },
                              { label: "Sin usar", value: item.stats.sinUsar },
                              { label: "Canceladas", value: item.stats.canceladas },
                              { label: "Reembolsado", value: formatPrecio(item.stats.reembolsado) },
                            ].map((c) => (
                              <div key={c.label} className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                                <p className="text-xs text-white/50">{c.label}</p>
                                <p className="text-lg font-bold">{c.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Tabla compradores */}
                          <div>
                            <p className="mb-2 text-sm font-semibold text-white/70">Compradores</p>
                            <div className="overflow-x-auto rounded-xl border border-white/10">
                              <table className="w-full text-left text-sm">
                                <thead className="border-b border-white/10 bg-white/5">
                                  <tr>
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3">Nombre</th>
                                    <th className="p-3">Email</th>
                                    <th className="p-3">Cant.</th>
                                    <th className="p-3">Monto</th>
                                    <th className="p-3">Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {historialDetalle.ordenes.map((o) => (
                                    <tr key={o.id} className="border-b border-white/5">
                                      <td className="p-3 text-white/60">{formatFechaCorta(o.createdAt)}</td>
                                      <td className="p-3">{o.compradorNombre}</td>
                                      <td className="p-3 text-white/60">{o.compradorEmail}</td>
                                      <td className="p-3">{o.cantidad}</td>
                                      <td className="p-3">{formatPrecio(o.montoTotal)}</td>
                                      <td className="p-3">
                                        <span
                                          className={`rounded-full px-2 py-1 text-xs ${
                                            o.estado === "aprobado"
                                              ? "bg-green-500/20 text-green-400"
                                              : o.estado === "reembolsado"
                                                ? "bg-yellow-500/20 text-yellow-400"
                                                : "bg-red-500/20 text-red-400"
                                          }`}
                                        >
                                          {o.estado}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                  {historialDetalle.ordenes.length === 0 && (
                                    <tr>
                                      <td colSpan={6} className="p-6 text-center text-white/40">Sin compras</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Tabla entradas */}
                          <div>
                            <p className="mb-2 text-sm font-semibold text-white/70">Entradas</p>
                            <div className="overflow-x-auto rounded-xl border border-white/10">
                              <table className="w-full text-left text-sm">
                                <thead className="border-b border-white/10 bg-white/5">
                                  <tr>
                                    <th className="p-3">Comprador</th>
                                    <th className="p-3">Entrada</th>
                                    <th className="p-3">Estado</th>
                                    <th className="p-3">Ingreso</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {historialDetalle.tickets.map((t) => (
                                    <tr key={t.id} className="border-b border-white/5">
                                      <td className="p-3">{t.compradorNombre}</td>
                                      <td className="p-3">{t.numeroEntrada}/{t.totalEntradas}</td>
                                      <td className="p-3">{ticketEstadoLabel(t)}</td>
                                      <td className="p-3 text-white/60">
                                        {t.usadoAt ? formatFechaCorta(t.usadoAt) : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                  {historialDetalle.tickets.length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="p-6 text-center text-white/40">Sin entradas</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PAGOS (TALO + MERCADO PAGO) ────────────────── */}
        {tab === "pagos" && (
          <div className="max-w-xl space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-base font-bold">Cobros de entradas</h2>
              <p className="mt-2 text-sm text-white/60">
                Configurá acá cómo cobrar. No hace falta entrar a Vercel. Activá los
                métodos que quieras; el comprador elige al pagar.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-2 text-base font-bold">Transferencia — Talo Pay</h2>
              <p className="mb-4 text-sm text-white/60">
                Los compradores transfieren y reciben el QR por mail automáticamente.
              </p>

              <div className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                <p className="font-semibold">¿Dónde las encuentro?</p>
                <p className="mt-1 text-blue-100/90">
                  Entrá a{" "}
                  <a
                    href="https://app.talo.com.ar"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    app.talo.com.ar
                  </a>{" "}
                  → Usuario → Credenciales
                </p>
              </div>

              {pagosInfo === null ? (
                <p className="text-sm text-white/40">Cargando...</p>
              ) : (
                <form onSubmit={handleSaveTaloPagos} className="space-y-4">
                  <label className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-sm">Ofrecer transferencia (Talo)</span>
                    <input
                      type="checkbox"
                      checked={pagosTaloForm.enabled}
                      onChange={(e) =>
                        setPagosTaloForm({ ...pagosTaloForm, enabled: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                  </label>

                  <Field
                    label="User ID"
                    value={pagosTaloForm.userId}
                    onChange={(v) => setPagosTaloForm({ ...pagosTaloForm, userId: v })}
                  />
                  <Field
                    label="Client ID"
                    value={pagosTaloForm.clientId}
                    onChange={(v) => setPagosTaloForm({ ...pagosTaloForm, clientId: v })}
                  />
                  <div>
                    <label className="mb-1 block text-sm text-white/60">Client Secret</label>
                    <input
                      type="password"
                      value={pagosTaloForm.clientSecret}
                      onChange={(e) =>
                        setPagosTaloForm({ ...pagosTaloForm, clientSecret: e.target.value })
                      }
                      placeholder={
                        pagosInfo.talo.hasSecret
                          ? "Dejá vacío para mantener el actual"
                          : "Pegá el Client Secret"
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-white/60">Ambiente</label>
                    <select
                      value={pagosTaloForm.environment}
                      onChange={(e) =>
                        setPagosTaloForm({
                          ...pagosTaloForm,
                          environment: e.target.value as "sandbox" | "production",
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                    >
                      <option value="production">Producción (pagos reales)</option>
                      <option value="sandbox">Sandbox (pruebas)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-sm">Estado</span>
                    {pagosInfo.talo.configured ? (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                        Configurado
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300">
                        Falta configurar
                      </span>
                    )}
                  </div>

                  {pagosTaloTestOk === true && (
                    <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                      Conexión con Talo verificada correctamente.
                    </div>
                  )}

                  {pagosTaloError && (
                    <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      {pagosTaloError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={pagosTaloLoading}
                      className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                    >
                      {pagosTaloLoading ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestTaloPagos}
                      disabled={pagosTaloTestLoading || !pagosInfo.talo.configured}
                      className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
                    >
                      {pagosTaloTestLoading ? "Probando..." : "Probar"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-2 text-base font-bold">Tarjeta — Mercado Pago</h2>
              <p className="mb-4 text-sm text-white/60">
                Los compradores pagan con tarjeta, débito o saldo de Mercado Pago.
              </p>

              <div className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
                <p className="font-semibold">¿Dónde lo encuentro?</p>
                <p className="mt-1 text-blue-100/90">
                  Entrá a{" "}
                  <a
                    href="https://www.mercadopago.com.ar/developers/panel/app"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    mercadopago.com.ar/developers
                  </a>{" "}
                  → Tu app → Credenciales de producción (o de prueba) → Access Token
                </p>
                <p className="mt-2 text-xs text-blue-100/80">
                  La primera vez, configurá el webhook en MP con la URL de abajo (evento: Pagos).
                </p>
              </div>

              {pagosInfo === null ? (
                <p className="text-sm text-white/40">Cargando...</p>
              ) : (
                <form onSubmit={handleSaveMpPagos} className="space-y-4">
                  <label className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-sm">Ofrecer tarjeta (Mercado Pago)</span>
                    <input
                      type="checkbox"
                      checked={pagosMpForm.enabled}
                      onChange={(e) =>
                        setPagosMpForm({ ...pagosMpForm, enabled: e.target.checked })
                      }
                      className="h-4 w-4"
                    />
                  </label>

                  <div>
                    <label className="mb-1 block text-sm text-white/60">Access Token</label>
                    <input
                      type="password"
                      value={pagosMpForm.accessToken}
                      onChange={(e) =>
                        setPagosMpForm({ ...pagosMpForm, accessToken: e.target.value })
                      }
                      placeholder={
                        pagosInfo.mp.hasToken
                          ? "Dejá vacío para mantener el actual"
                          : "Pegá el Access Token"
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-white/60">Ambiente</label>
                    <select
                      value={pagosMpForm.environment}
                      onChange={(e) =>
                        setPagosMpForm({
                          ...pagosMpForm,
                          environment: e.target.value as "sandbox" | "production",
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                    >
                      <option value="production">Producción (pagos reales)</option>
                      <option value="sandbox">Prueba (sandbox)</option>
                    </select>
                  </div>

                  <div className="rounded-xl border border-white/10 px-4 py-3">
                    <p className="mb-1 text-xs text-white/50">Webhook (copiar en panel de MP)</p>
                    <p className="break-all font-mono text-xs text-white/70">
                      {pagosInfo.mp.webhookUrl}
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-sm">Estado</span>
                    {pagosInfo.mp.configured ? (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                        Configurado
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300">
                        Falta configurar
                      </span>
                    )}
                  </div>

                  {pagosMpTestOk === true && (
                    <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                      Conexión con Mercado Pago verificada correctamente.
                    </div>
                  )}

                  {pagosMpError && (
                    <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      {pagosMpError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={pagosMpLoading}
                      className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                    >
                      {pagosMpLoading ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestMpPagos}
                      disabled={pagosMpTestLoading || !pagosInfo.mp.configured}
                      className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
                    >
                      {pagosMpTestLoading ? "Probando..." : "Probar"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── SEGURIDAD ────────────────────────────────────── */}
        {tab === "seguridad" && (
          <div className="max-w-xl space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-2 text-base font-bold">Acceso al sistema</h2>
              <p className="mb-4 text-sm text-white/60">
                PIN Admin: panel completo. PIN Scanner: solo validar entradas en la puerta.
              </p>
              {security === null ? (
                <p className="text-sm text-white/40">Verificando…</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-sm">PIN Admin</span>
                    {security.adminPinDebil ? (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">
                        Cambiá el PIN de prueba
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                        OK
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-sm">PIN Scanner</span>
                    {security.scannerPinDebil ? (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">
                        Cambiá el PIN de prueba
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                        OK
                      </span>
                    )}
                  </div>
                  {security.ambosIguales && !security.adminPinDebil && (
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
                      Usá PINs distintos: uno para vos (admin) y otro para la puerta (scanner).
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setPinChangeOpen(true);
                  setPinForm(EMPTY_PIN_FORM);
                  setPinChangeError("");
                }}
                className="mt-5 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black hover:bg-white/90"
              >
                Cambiar PINs
              </button>
            </div>

            {pinChangeOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-6">
                  <h2 className="mb-2 text-lg font-bold">Cambiar PINs</h2>
                  <p className="mb-4 text-sm text-white/60">
                    Al guardar, vas a tener que ingresar de nuevo con el PIN admin nuevo.
                  </p>
                  <form onSubmit={handleChangePins} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-white/60">PIN admin actual</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.pinActual}
                        onChange={(e) => setPinForm({ ...pinForm, pinActual: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/60">PIN admin nuevo</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.pinAdminNuevo}
                        onChange={(e) => setPinForm({ ...pinForm, pinAdminNuevo: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Confirmar PIN admin nuevo</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.pinAdminConfirm}
                        onChange={(e) => setPinForm({ ...pinForm, pinAdminConfirm: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/60">PIN scanner nuevo (puerta)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.pinScannerNuevo}
                        onChange={(e) => setPinForm({ ...pinForm, pinScannerNuevo: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Confirmar PIN scanner nuevo</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.pinScannerConfirm}
                        onChange={(e) => setPinForm({ ...pinForm, pinScannerConfirm: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                      />
                    </div>
                    {pinChangeError && (
                      <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {pinChangeError}
                      </p>
                    )}
                    <p className="text-xs text-white/40">Mínimo 6 caracteres. Admin y scanner deben ser distintos.</p>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPinChangeOpen(false);
                          setPinForm(EMPTY_PIN_FORM);
                          setPinChangeError("");
                        }}
                        className="flex-1 rounded-xl border border-white/10 py-3 text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={pinChangeLoading}
                        className="flex-1 rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50"
                      >
                        {pinChangeLoading ? "Guardando..." : "Guardar PINs"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-2 text-base font-bold">Sesión</h2>
              <p className="mb-4 text-sm text-white/60">
                La sesión dura 12 horas. Podés cerrarla manualmente.
              </p>
              <button
                onClick={logout}
                className="rounded-xl border border-white/20 px-5 py-2 text-sm font-semibold hover:bg-white/5"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
