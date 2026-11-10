"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { TiposEntradaPanel } from "@/components/admin/TiposEntradaPanel";
import { BrandingForm } from "@/components/admin/BrandingForm";
import { VentasGenerales } from "@/components/admin/VentasGenerales";
import { AnularModal } from "@/components/admin/AnularModal";
import { ChecklistPruebas } from "@/components/admin/ChecklistPruebas";
import { ConectarMercadoPago } from "@/components/admin/ConectarMercadoPago";
import { EtapasVenta } from "@/components/admin/EtapasVenta";
import { GuiaInicio } from "@/components/admin/GuiaInicio";
import { MARCA_ISOTIPO } from "@/components/publico/Marca";
import { getEstiloEntrada } from "@/lib/entradas/estilos";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import type {
  ActivityLog,
  AdminStats,
  Evento,
  HistorialItem,
  ModoPago,
  Orden,
  Ticket,
} from "@/types";
import {
  canAbrirVenta,
  canCerrarEvento,
  canPausarVentas,
  canReanudarVentas,
  canResetVentas,
  EVENTO_ESTADO_LABELS,
} from "@/lib/evento/estado";
import {
  diaCorto,
  formatFecha,
  formatFechaCorta,
  formatPrecio,
  isoToDatetimeLocalAr,
  ticketEstadoLabel,
} from "@/lib/utils";

type Tab = "resumen" | "tipos" | "compras" | "entradas" | "apariencia" | "marca" | "actividad" | "historial" | "pagos" | "seguridad";

const LS_EVENTO = "admin.eventoId";
const LS_GUIA_OCULTA = "admin.guiaOculta";
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
  modo?: { simulate: boolean; sandbox: boolean; sinMedios: boolean; appMode: string };
}

interface ModoCobro {
  simulate: boolean;
  sandbox: boolean;
  sinMedios: boolean;
}

function ChipModo({ modo }: { modo: ModoPago | null }) {
  if (modo === "simulado")
    return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-white/60">SIMULADA</span>;
  if (modo === "sandbox")
    return <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-amber-300">PRUEBA</span>;
  return null;
}

function estadoMedioLabel(m: { enabled: boolean; configured: boolean; environment: "sandbox" | "production" }) {
  if (!m.configured) return { texto: "Sin conectar", clase: "bg-yellow-500/20 text-yellow-300" };
  if (!m.enabled) return { texto: "Pausado", clase: "bg-white/10 text-white/50" };
  if (m.environment === "sandbox") return { texto: "Modo prueba", clase: "bg-amber-400/20 text-amber-300" };
  return { texto: "Cobros reales", clase: "bg-green-500/20 text-green-400" };
}

interface HistorialDetalle {
  ordenes: Orden[];
  tickets: Ticket[];
}

function estadoBadgeClass(estado: Evento["estado"]): string {
  if (estado === "borrador") return "bg-yellow-500/20 text-yellow-300";
  if (estado === "venta") return "bg-green-500/20 text-green-400";
  if (estado === "pausado") return "bg-amber-500/20 text-amber-300";
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

/** Color con selector visual (sin tener que escribir el código). */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valido = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div>
      <label className="mb-1 block text-sm text-white/60">{label}</label>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
        <input
          type="color"
          aria-label={label}
          value={valido ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-white/20 bg-transparent"
        />
        <span className="font-mono text-sm text-white/60">{value}</span>
      </div>
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
  // Copia editable de la fiesta (Apariencia). No se pisa con la actualización en vivo mientras hay cambios.
  const [draft, setDraftState] = useState<Evento | null>(null);
  const dirtyRef = useRef(false);
  const setDraft = (e: Evento) => {
    dirtyRef.current = true;
    setDraftState(e);
  };
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState<string>("");
  const [version, setVersion] = useState(0);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [anularOrdenId, setAnularOrdenId] = useState<string | null>(null);
  const [modoCobro, setModoCobro] = useState<ModoCobro | null>(null);
  // Guía de puesta en marcha: visible hasta que la ocultan en este dispositivo.
  const [guiaAbierta, setGuiaAbierta] = useState(false);

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
  const [pagosTaloLoading, setPagosTaloLoading] = useState(false);
  const [pagosTaloTestLoading, setPagosTaloTestLoading] = useState(false);
  const [pagosTaloError, setPagosTaloError] = useState("");
  const [pagosTaloTestOk, setPagosTaloTestOk] = useState<boolean | null>(null);

  function showToast(type: Toast["type"], text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  useEffect(() => {
    try {
      setGuiaAbierta(localStorage.getItem(LS_GUIA_OCULTA) !== "1");
    } catch {
      setGuiaAbierta(true);
    }
  }, []);

  function mostrarGuia(abierta: boolean) {
    setGuiaAbierta(abierta);
    try {
      if (abierta) localStorage.removeItem(LS_GUIA_OCULTA);
      else localStorage.setItem(LS_GUIA_OCULTA, "1");
    } catch {
      /* ignore */
    }
  }

  // Fiesta elegida: la guardada en este teléfono o la próxima.
  useEffect(() => {
    let guardado = "";
    try {
      guardado = localStorage.getItem(LS_EVENTO) ?? "";
    } catch {
      /* ignore */
    }
    fetch("/api/admin/eventos", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const lista = (d.eventos ?? []) as Evento[];
        setEventos(lista);
        const elegido =
          lista.find((x) => x.id === guardado)?.id ??
          lista.find((x) => new Date(x.fecha).getTime() > Date.now() - 12 * 3600 * 1000)?.id ??
          lista[0]?.id ??
          "";
        setEventoId(elegido);
      });
  }, []);

  function elegirEvento(id: string) {
    dirtyRef.current = false;
    setEventoId(id);
    setFiltroTipo("");
    try {
      localStorage.setItem(LS_EVENTO, id);
    } catch {
      /* ignore */
    }
  }

  const refresh = useCallback(async () => {
    const lista = await fetch("/api/admin/eventos", { cache: "no-store" }).then((r) => r.json());
    setEventos(lista.eventos ?? []);
    setVersion((v) => v + 1);
    if (!eventoId) {
      setEvento(null);
      setStats(null);
      setOrdenes([]);
      setTickets([]);
      return;
    }
    const q = `?evento=${encodeURIComponent(eventoId)}`;
    const [s, o, t, a, e] = await Promise.all([
      fetch(`/api/admin/stats${q}`).then((r) => r.json()),
      fetch(`/api/admin/ordenes${q}`).then((r) => r.json()),
      fetch(`/api/admin/tickets${q}`).then((r) => r.json()),
      fetch("/api/admin/activity").then((r) => r.json()),
      fetch(`/api/admin/evento${q}`).then((r) => r.json()),
    ]);
    setStats(s?.porTipo ? s : null);
    setOrdenes(o.ordenes ?? []);
    setTickets(t.tickets ?? []);
    setActivity(a.activity ?? []);
    const ev = e?.id ? ({ ...e, estado: e.estado ?? "borrador" } as Evento) : null;
    setEvento(ev);
    if (!dirtyRef.current) setDraftState(ev);
  }, [eventoId]);

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

  // Modo de cobro (simulación / prueba / real) para avisos del panel.
  useEffect(() => {
    fetch("/api/checkout", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setModoCobro({ simulate: Boolean(d.simulate), sandbox: Boolean(d.sandbox), sinMedios: Boolean(d.sinMedios) }))
      .catch(() => {});
  }, [pagosInfo]);

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
      });
  }, [tab, pagosInfo]);

  /** Vuelve a leer el estado de Mercado Pago sin desmontar el formulario (así no se pierde el resultado). */
  async function recargarEstadoPagos() {
    try {
      const d = await fetch("/api/admin/pagos", { cache: "no-store" }).then((r) => r.json());
      if (d?.mp) setPagosInfo(d);
    } catch {
      /* se actualiza al volver a entrar a la pestaña */
    }
    setVersion((v) => v + 1);
  }

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
    if (!confirm("¿Dar de baja esta entrada SIN devolver plata? El QR deja de valer. Si el comprador pidió la devolución, usá Compras → Anular.")) return;
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

  async function handleDevueltaSinCupo(o: Orden) {
    if (
      !confirm(
        `¿Ya le devolviste ${formatPrecio(o.montoTotal)} a ${o.compradorNombre}? La compra queda cerrada como devuelta.`
      )
    )
      return;
    setActionLoading(o.id);
    try {
      const res = await fetch(`/api/admin/ordenes/${o.id}/devuelta`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "No se pudo guardar");
        return;
      }
      showToast("success", "Devolución registrada");
      refresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevisarPago(o: Orden) {
    setActionLoading(o.id);
    try {
      const res = await fetch(`/api/admin/ordenes/${o.id}/revisar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "No se pudo consultar");
        return;
      }
      if (data.orden?.estado === "aprobado") showToast("success", "Estaba paga: entradas emitidas (las ve en su pantalla o le pasás el PDF)");
      else if (data.orden?.problema === "pago_sin_cupo") showToast("error", "Pagó pero ya no quedaban entradas: hay que devolverle la plata");
      else if (data.error) showToast("error", data.error);
      else showToast("success", "Todavía no hay un pago aprobado para esta compra");
      refresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function persistEvento(updated: Evento, successMsg?: string) {
    const res = await fetch(`/api/admin/evento?evento=${encodeURIComponent(updated.id)}`, {
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
    dirtyRef.current = false;
    refresh();
    return true;
  }

  async function handleImageUploaded(field: "logoUrl" | "flyerUrl", url: string) {
    if (!draft) return;
    const updated = { ...draft, [field]: url };
    setDraft(updated);
    const label = field === "logoUrl" ? "Logo actualizado" : "Flyer actualizado";
    await persistEvento(updated, label);
  }

  async function handleSaveEvento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    await persistEvento(draft, "Cambios guardados");
    setSaving(false);
  }

  /** Copia el mensaje de "Próximamente" de esta fiesta a todas las demás (no cambia nada más). */
  async function copiarMensajeProximamente() {
    if (!draft) return;
    const mensaje = (draft.mensajeProximamente ?? "").trim();
    if (!confirm(`¿Usar este mensaje de Próximamente en las ${eventos.length} fiestas?`)) return;
    setSaving(true);
    try {
      let fallaron = 0;
      for (const e of eventos) {
        const res = await fetch(`/api/admin/evento?evento=${encodeURIComponent(e.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensajeProximamente: mensaje }),
        });
        if (!res.ok) fallaron += 1;
      }
      showToast(
        fallaron ? "error" : "success",
        fallaron ? `No se pudo guardar en ${fallaron} fiestas. Probá de nuevo.` : `Mensaje guardado en las ${eventos.length} fiestas`
      );
      refresh();
    } finally {
      setSaving(false);
    }
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
        body: JSON.stringify({ confirmacion: resetConfirm, eventoId }),
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

  async function handleEstadoAccion(
    accion: "abrir_venta" | "pausar" | "reanudar" | "cerrar"
  ) {
    const messages: Record<typeof accion, string> = {
      abrir_venta: evento?.proximamente
        ? "¿Publicar esta fiesta? Va a aparecer en la página como Próximamente (todavía sin venta). Después de publicar no se pueden reiniciar las ventas."
        : "¿Publicar esta fiesta? Va a aparecer en la página y se puede comprar. Después de publicar no se pueden reiniciar las ventas.",
      pausar:
        "¿Pausar ventas? Nadie podrá comprar nuevo, pero las entradas vendidas siguen válidas.",
      reanudar: "¿Reanudar ventas? La compra pública volverá a estar habilitada.",
      cerrar:
        "¿Cerrar y archivar esta fiesta? Sale de la página y los datos quedan en Historial.",
    };
    let mensaje = messages[accion];
    if ((accion === "abrir_venta" || accion === "reanudar") && modoCobro && (modoCobro.simulate || modoCobro.sandbox)) {
      mensaje = `ATENCIÓN: los pagos están en ${modoCobro.simulate ? "simulación (no se cobra nada)" : "modo prueba (no se cobra de verdad)"}. Antes de vender, conectá la cuenta real de Mercado Pago en la pestaña Pagos.\n\n${mensaje}`;
    }
    if ((accion === "abrir_venta" || accion === "reanudar") && modoCobro?.sinMedios) {
      mensaje = `ATENCIÓN: Mercado Pago no está conectado: nadie va a poder pagar hasta que lo conectes en Pagos.\n\n${mensaje}`;
    }
    if (!confirm(mensaje)) return;

    setActionLoading(accion);
    try {
      const res = await fetch("/api/admin/evento/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, eventoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error ?? "No se pudo actualizar el estado");
        return;
      }
      const successMessages: Record<typeof accion, string> = {
        abrir_venta: "Fiesta publicada",
        pausar: "Ventas pausadas",
        reanudar: "Ventas reanudadas",
        cerrar: "Fiesta cerrada y archivada en Historial",
      };
      showToast("success", successMessages[accion]);
      setHistorialItems(null);
      if (accion === "cerrar") {
        const resto = eventos.filter((x) => x.id !== eventoId);
        elegirEvento(resto[0]?.id ?? "");
      }
      refresh();
    } finally {
      setActionLoading(null);
    }
  }

  /** Saca la fiesta elegida de "Próximamente": empieza a vender según sus tipos de entrada. */
  async function abrirVentaFiesta() {
    if (!evento) return;
    let mensaje = `¿Abrir la venta de ${evento.nombre}? Desde ese momento se puede comprar lo que esté "A la venta".`;
    if (modoCobro && (modoCobro.simulate || modoCobro.sandbox)) {
      mensaje = `ATENCIÓN: los pagos están en ${modoCobro.simulate ? "simulación" : "modo prueba"} (no se cobra de verdad). Conectá la cuenta real en Pagos antes de vender.\n\n${mensaje}`;
    } else if (modoCobro?.sinMedios) {
      mensaje = `ATENCIÓN: Mercado Pago no está conectado: nadie va a poder pagar. Conectalo en Pagos.\n\n${mensaje}`;
    }
    if (!confirm(mensaje)) return;
    await persistEvento({ ...evento, proximamente: false, ventaAbre: null }, "Venta abierta");
  }

  async function copyOrdenLink(ordenId: string) {
    const url = `${window.location.origin}/compra/exito?orden=${ordenId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("success", "Link de entradas copiado");
    } catch {
      showToast("error", "No se pudo copiar el link");
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
      showToast("success", `"${data.evento.nombre}" creada en borrador. Cargá el flyer y los tipos de entrada.`);
      setHistorialItems(null);
      elegirEvento(data.evento.id);
      setTab("tipos");
    } finally {
      setNuevoLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/staff";
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

  async function handleChangePins(e: React.FormEvent) {
    e.preventDefault();
    setPinChangeError("");

    if (!pinForm.pinActual) {
      setPinChangeError("Ingresá tu PIN actual");
      return;
    }
    if (pinForm.pinAdminNuevo.length < 6) {
      setPinChangeError("El PIN del organizador debe tener al menos 6 números");
      return;
    }
    if (pinForm.pinScannerNuevo.length < 6) {
      setPinChangeError("El PIN de puerta debe tener al menos 6 números");
      return;
    }
    if (pinForm.pinAdminNuevo === pinForm.pinScannerNuevo) {
      setPinChangeError("Los dos PIN tienen que ser distintos");
      return;
    }
    if (pinForm.pinAdminNuevo !== pinForm.pinAdminConfirm) {
      setPinChangeError("El PIN del organizador no coincide con su repetición");
      return;
    }
    if (pinForm.pinScannerNuevo !== pinForm.pinScannerConfirm) {
      setPinChangeError("El PIN de puerta no coincide con su repetición");
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
    { id: "tipos", label: "Entradas y precios" },
    { id: "compras", label: "Compras" },
    { id: "entradas", label: "Entradas emitidas" },
    { id: "apariencia", label: "Fiesta" },
    { id: "marca", label: "Marca" },
    { id: "actividad", label: "Actividad" },
    { id: "historial", label: "Historial" },
    { id: "pagos", label: "Pagos" },
    { id: "seguridad", label: "Seguridad" },
  ];

  return (
    <div className="min-h-screen bg-[#07070b]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-noche/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <a href="/staff" className="flex shrink-0 items-center gap-2" aria-label="Menú staff">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MARCA_ISOTIPO} alt="" width={28} height={30} />
              <span className="hidden font-display text-[11px] tracking-[0.22em] sm:inline">PANEL</span>
            </a>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 sm:max-w-md">
              <label htmlFor="fiesta-admin" className="shrink-0 text-[10px] font-semibold tracking-[0.14em] text-white/45">
                FIESTA
              </label>
              <select
                id="fiesta-admin"
                value={eventoId}
                onChange={(e) => elegirEvento(e.target.value)}
                className="min-w-0 flex-1 truncate bg-transparent py-1 font-display text-sm font-bold text-white outline-none"
              >
                {eventos.length === 0 && <option value="">Sin fiestas</option>}
                {eventos.map((x) => (
                  <option key={x.id} value={x.id} className="bg-noche">
                    {diaCorto(x.fecha)} · {x.nombre}
                    {x.estado === "borrador" ? " (borrador)" : x.estado === "pausado" ? " (pausada)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {evento && (
              <span className={`hidden shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold sm:inline-block ${estadoBadgeClass(evento.estado)}`}>
                {EVENTO_ESTADO_LABELS[evento.estado].split(" —")[0]}
              </span>
            )}
            {modoCobro && (modoCobro.simulate || modoCobro.sandbox) && (
              <button
                type="button"
                onClick={() => setTab("pagos")}
                className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-extrabold tracking-[0.1em] text-tinta"
                title="Los pagos no son reales. Tocá para ver Pagos."
              >
                {modoCobro.simulate ? "SIMULACIÓN" : "MODO PRUEBA"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTab("resumen");
                mostrarGuia(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
            >
              Ayuda
            </button>
            <button
              onClick={() => {
                setTab("resumen");
                setNuevoOpen(true);
              }}
              className="rounded-lg bg-oro px-3 py-2 text-sm font-bold text-tinta hover:brightness-110"
            >
              + Nueva fiesta
            </button>
            {evento && (
              <a
                href={`/fiesta/${evento.slug}`}
                target="_blank"
                className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5"
              >
                Ver página
              </a>
            )}
            <a href="/scanner" className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
              Scanner
            </a>
            <button onClick={logout} className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
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
                tab === t.id ? "bg-oro text-tinta" : "text-white/60 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Aviso fijo abajo: se ve aunque la página esté scrolleada. */}
        {toast && (
          <p
            role="status"
            className={`fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-xl rounded-xl border px-4 py-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.6)] ${
              toast.type === "success"
                ? "border-green-500/40 bg-[#0d1f14] text-green-300"
                : "border-red-500/40 bg-[#240f0f] text-red-300"
            }`}
          >
            {toast.text}
          </p>
        )}

        {/* ── RESUMEN ────────────────────────────────────── */}
        {tab === "resumen" && (
          <>
            {guiaAbierta && (
              <GuiaInicio
                version={version}
                onIr={(t) => setTab(t)}
                onCerrar={() => mostrarGuia(false)}
                onToast={showToast}
                onChanged={refresh}
              />
            )}
            {evento ? (
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/50">{diaCorto(evento.fecha)} · {evento.lugar || "Lugar a confirmar"}</p>
                    <p className="mt-1 text-lg font-bold">{evento.nombre}</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${estadoBadgeClass(evento.estado)}`}
                    >
                      {EVENTO_ESTADO_LABELS[evento.estado]}
                    </span>
                    {evento.proximamente && (
                      <span className="ml-2 mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                        Próximamente{evento.ventaAbre ? ` · abre ${formatFechaCorta(evento.ventaAbre)}` : " · fecha a confirmar"}
                      </span>
                    )}
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
                        {actionLoading === "abrir_venta" ? "..." : "Publicar"}
                      </button>
                    )}
                    {canPausarVentas(evento.estado) && (
                      <button
                        type="button"
                        onClick={() => handleEstadoAccion("pausar")}
                        disabled={actionLoading === "pausar"}
                        className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        {actionLoading === "pausar" ? "..." : "Pausar ventas"}
                      </button>
                    )}
                    {canReanudarVentas(evento.estado) && (
                      <button
                        type="button"
                        onClick={() => handleEstadoAccion("reanudar")}
                        disabled={actionLoading === "reanudar"}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        {actionLoading === "reanudar" ? "..." : "Reanudar ventas"}
                      </button>
                    )}
                    {canCerrarEvento(evento.estado) && (
                      <button
                        type="button"
                        onClick={() => handleEstadoAccion("cerrar")}
                        disabled={actionLoading === "cerrar"}
                        className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
                      >
                        {actionLoading === "cerrar" ? "..." : "Cerrar fiesta"}
                      </button>
                    )}
                  </div>
                </div>
                {evento.estado === "borrador" && (
                  <p className="mt-4 text-xs text-white/40">
                    Borrador: todavía no aparece en la página. Podés verla con &quot;Ver página&quot; y hacer compras
                    de prueba; antes de publicar, tocá Reiniciar ventas para borrarlas.
                  </p>
                )}
                {evento.estado === "pausado" && (
                  <p className="mt-4 text-xs text-amber-200/80">
                    Ventas pausadas: nadie puede comprar, pero las entradas ya vendidas siguen valiendo en la puerta.
                    Con &quot;Copiar link&quot; en Compras le reenviás sus entradas a un comprador por WhatsApp.
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="mb-4 text-white/60">
                  No hay fiestas activas. Las anteriores están en{" "}
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
                  + Crear nueva fiesta
                </button>
              </div>
            )}

            {/* Modal reiniciar */}
            {resetOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-[#12121a] p-6">
                  <h2 className="text-lg font-bold text-red-400">Reiniciar ventas</h2>
                  <p className="mt-2 text-sm text-white/60">
                    Borra todas las compras y entradas de esta fiesta, sin dejar registro. Sirve para limpiar las
                    pruebas antes de publicar. Las entradas borradas dejan de valer en la puerta.
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
                  <h2 className="mb-4 text-lg font-bold">Nueva fiesta</h2>
                  <form onSubmit={handleCrearNuevo} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Nombre (colegio)</label>
                      <input
                        value={nuevoForm.nombre}
                        onChange={(e) => setNuevoForm({ ...nuevoForm, nombre: e.target.value })}
                        placeholder="Ej: Colegio Secundario San Martín"
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
                        <label className="mb-1 block text-sm text-white/60">Precio General ($)</label>
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
                        Copiar colores, lugar y contacto de la última fiesta
                      </span>
                    </label>
                    {nuevoError && (
                      <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {nuevoError}
                      </p>
                    )}
                    <p className="text-xs text-white/40">
                      Se crea en borrador con una entrada General. Después sumás Anticipada/VIP y cargás el flyer.
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
                        {nuevoLoading ? "Creando..." : "Crear fiesta"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {evento && (
              <EtapasVenta
                evento={evento}
                version={version}
                totalFiestas={eventos.length}
                onToast={showToast}
                onChanged={refresh}
                onVerTodo={() => setTab("tipos")}
                onAbrirFiesta={abrirVentaFiesta}
              />
            )}

            {stats && evento && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: "Recaudado (neto)", value: formatPrecio(stats.recaudado), color: "#f0d389" },
                    { label: "Vendidas", value: `${stats.vendidasActivas} / ${stats.capacidad}`, color: "#fff" },
                    { label: "Ya ingresaron", value: stats.ingresaron, color: "#4ade80" },
                    { label: "Quedan", value: stats.disponibles, color: "#93c5fd" },
                    { label: "Compras", value: stats.totalOrdenes, color: "#fff" },
                    { label: "Sin usar", value: stats.sinUsar, color: "#cbd5e1" },
                    { label: "Anuladas / bajas", value: stats.canceladas, color: "#f87171" },
                    { label: "Devuelto", value: formatPrecio(stats.reembolsado), color: "#fbbf24" },
                  ].map((card) => (
                    <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs text-white/50">{card.label}</p>
                      <p className="mt-1 font-display text-2xl font-extrabold" style={{ color: card.color }}>
                        {card.value}
                      </p>
                    </div>
                  ))}
                </div>
                {stats.porTipo.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.porTipo.map((p) => {
                      const e = getEstiloEntrada({ estilo: p.estilo, colorEvento: evento.colorPrimario, fondoEvento: evento.colorSecundario });
                      return (
                        <button
                          type="button"
                          key={`${p.tipoEntradaId}-${p.nombre}`}
                          onClick={() => setTab("tipos")}
                          className="flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition hover:brightness-110"
                          style={{ borderColor: `${e.acento}66`, backgroundColor: `${e.acento}12` }}
                        >
                          <div className="flex flex-col">
                            <span className="font-display text-sm font-bold" style={{ color: e.acento }}>{p.nombre}</span>
                            <span className="text-xs text-white/60">
                              {p.vendidas} vendidas{p.cupo !== null ? ` de ${p.cupo}` : ""}
                            </span>
                          </div>
                          <span className="font-display text-lg font-extrabold">{formatPrecio(p.recaudado)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-10">
              <VentasGenerales version={version} eventoSeleccionado={eventoId} onSeleccionar={elegirEvento} />
            </div>
          </>
        )}

        {/* ── TIPOS DE ENTRADA ──────────────────────────────── */}
        {tab === "tipos" && evento && (
          <TiposEntradaPanel evento={evento} porTipo={stats?.porTipo ?? []} onToast={showToast} onChanged={refresh} />
        )}
        {tab === "tipos" && !evento && <p className="text-white/40">Elegí o creá una fiesta.</p>}

        {/* ── MARCA ────────────────────────────────────────── */}
        {tab === "marca" && <BrandingForm onToast={showToast} />}

        {/* ── COMPRAS ────────────────────────────────────── */}
        {tab === "compras" && ordenes.some((o) => o.problema === "pago_sin_cupo" && o.estado === "pendiente") && (
          <div role="alert" className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            <p className="font-bold text-red-300">Hay pagos que entraron sin entradas disponibles</p>
            <p className="mt-1 text-red-200/90">
              Se vendieron las últimas mientras esas personas pagaban. No se les emitió entrada: devolveles la plata desde
              Mercado Pago o la cuenta de Talo y avisales por mail o WhatsApp. Están marcadas abajo con{" "}
              <strong>PAGO SIN CUPO</strong>.
            </p>
          </div>
        )}
        {tab === "compras" && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/55">
              {ordenes.length} {ordenes.length === 1 ? "compra" : "compras"} en esta fiesta.
            </p>
            <div className="flex flex-wrap gap-2">
              {eventoId && (
                <a
                  href={`/api/admin/ordenes/export?evento=${encodeURIComponent(eventoId)}`}
                  className="flex h-9 items-center rounded-lg border border-white/20 px-3.5 text-xs font-semibold hover:bg-white/5"
                >
                  Descargar para Excel
                </a>
              )}
              <a
                href="/api/admin/ordenes/export"
                className="flex h-9 items-center rounded-lg border border-white/20 px-3.5 text-xs font-semibold hover:bg-white/5"
                title="Copia de respaldo con las compras de todas las fiestas"
              >
                Descargar todas las fiestas
              </a>
            </div>
          </div>
        )}
        {tab === "compras" && (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Comprador</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Cant.</th>
                  <th className="p-3">Monto</th>
                  <th className="p-3">Devuelto</th>
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
                    <td className="p-3">{o.tipoNombre}</td>
                    <td className="p-3">{o.cantidad}</td>
                    <td className="p-3">{formatPrecio(o.montoTotal)}</td>
                    <td className="p-3 text-white/60">{o.montoReembolsado > 0 ? formatPrecio(o.montoReembolsado) : "—"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
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
                        {o.estado === "aprobado"
                          ? "Pagada"
                          : o.estado === "reembolsado"
                            ? "Anulada"
                            : o.estado === "pendiente"
                              ? "Sin pagar"
                              : "Rechazada o vencida"}
                      </span>
                      {o.estado === "aprobado" && o.montoReembolsado > 0 && (
                        <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] text-yellow-300">anulación parcial</span>
                      )}
                      <ChipModo modo={o.modoPago} />
                      {o.problema === "pago_sin_cupo" && o.estado === "pendiente" && (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-white">
                          PAGO SIN CUPO · DEVOLVER
                        </span>
                      )}
                      </div>
                    </td>
                    <td className="p-3">
                      {(o.estado === "pendiente" || o.estado === "rechazado") && !o.problema && (
                        <button
                          type="button"
                          disabled={actionLoading === o.id}
                          onClick={() => handleRevisarPago(o)}
                          title="Consulta en Mercado Pago o Talo si esta compra se pagó"
                          className="text-left text-xs text-blue-400 hover:underline disabled:opacity-50"
                        >
                          {actionLoading === o.id ? "Consultando…" : "Revisar pago"}
                        </button>
                      )}
                      {o.estado === "pendiente" && o.problema === "pago_sin_cupo" && (
                        <button
                          type="button"
                          disabled={actionLoading === o.id}
                          onClick={() => handleDevueltaSinCupo(o)}
                          className="text-left text-xs font-semibold text-red-300 hover:underline disabled:opacity-50"
                        >
                          Ya le devolví la plata
                        </button>
                      )}
                      {o.estado === "aprobado" && (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => copyOrdenLink(o.id)}
                            className="text-left text-xs text-blue-400 hover:underline"
                          >
                            Copiar link
                          </button>
                          <a
                            href={`/api/ordenes/${o.id}/pdf`}
                            className="text-left text-xs text-oro hover:underline"
                          >
                            Descargar PDF
                          </a>
                          <button
                            type="button"
                            onClick={() => setAnularOrdenId(o.id)}
                            className="text-left text-xs text-red-400 hover:underline"
                          >
                            Anular…
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {ordenes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-white/40">
                      Sin compras aún
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {anularOrdenId && (
          <AnularModal
            ordenId={anularOrdenId}
            onClose={() => setAnularOrdenId(null)}
            onDone={(msg) => {
              setAnularOrdenId(null);
              showToast("success", msg);
              refresh();
            }}
          />
        )}

        {/* ── ENTRADAS ────────────────────────────────────── */}
        {tab === "entradas" && (
          <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {["", ...Array.from(new Set(tickets.map((t) => t.tipoNombre)))].map((tn) => (
              <button
                key={tn || "todas"}
                type="button"
                onClick={() => setFiltroTipo(tn)}
                className={`h-9 rounded-full border px-4 text-xs font-semibold ${
                  filtroTipo === tn ? "border-oro bg-oro/15 text-oro-claro" : "border-white/12 text-white/60"
                }`}
              >
                {tn || "Todas"} ({tn ? tickets.filter((t) => t.tipoNombre === tn).length : tickets.length})
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Comprador</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Entrada</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Ingreso</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tickets.filter((t) => !filtroTipo || t.tipoNombre === filtroTipo).map((t) => (
                  <tr key={t.id} className="border-b border-white/5">
                    <td className="p-3 font-mono text-xs text-white/40">{t.id.slice(0, 8)}…</td>
                    <td className="p-3">{t.compradorNombre}</td>
                    <td className="p-3">{t.tipoNombre}</td>
                    <td className="p-3">{t.numeroEntrada}/{t.totalEntradas}</td>
                    <td className="p-3">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {ticketEstadoLabel(t)}
                        <ChipModo modo={ordenes.find((o) => o.id === t.ordenId)?.modoPago ?? null} />
                      </span>
                    </td>
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
                          {actionLoading === t.id ? "..." : "Dar de baja (sin devolver plata)"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-white/40">
                      Sin entradas aún
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {/* ── APARIENCIA ────────────────────────────────────── */}
        {tab === "apariencia" && draft && (
          <form onSubmit={handleSaveEvento} className="max-w-2xl space-y-4">
            <Field
              label="Nombre (colegio)"
              value={draft.nombre}
              onChange={(v) => setDraft({ ...draft, nombre: v })}
            />
            <div>
              <label className="mb-1 block text-sm text-white/60">Link de la fiesta</label>
              <div className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <span className="shrink-0 pl-4 text-sm text-white/40">/fiesta/</span>
                <input
                  value={draft.slug}
                  onChange={(e) =>
                    setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") })
                  }
                  className="min-w-0 flex-1 bg-transparent px-1 py-3 outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-white/40">Solo minúsculas, números y guiones. Es el link que compartís.</p>
            </div>
            <Field
              label="Subtítulo"
              value={draft.subtitulo}
              onChange={(v) => setDraft({ ...draft, subtitulo: v })}
            />
            <Field label="DJ" value={draft.dj} onChange={(v) => setDraft({ ...draft, dj: v })} />
            <div>
              <label className="mb-1 block text-sm text-white/60">Fecha y hora del evento</label>
              <input
                type="datetime-local"
                value={isoToDatetimeLocalAr(draft.fecha)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    fecha: e.target.value ? `${e.target.value}:00-03:00` : draft.fecha,
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none [color-scheme:dark]"
              />
              <p className="mt-1 text-xs text-white/40">Hora Argentina (24 h, ej. 20:00)</p>
            </div>
            <ImageUploadField
              label="Flyer de la fiesta"
              kind="flyer"
              eventoId={draft.id}
              value={draft.flyerUrl}
              onChange={(url) => handleImageUploaded("flyerUrl", url)}
              onError={(m) => showToast("error", m)}
              previewClassName="h-48 w-full"
            />
            <ImageUploadField
              label="Logo"
              kind="logo"
              eventoId={draft.id}
              value={draft.logoUrl}
              onChange={(url) => handleImageUploaded("logoUrl", url)}
              onError={(m) => showToast("error", m)}
              previewClassName="h-24 w-24"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Color principal (botones y detalles)" value={draft.colorPrimario} onChange={(v) => setDraft({ ...draft, colorPrimario: v })} />
              <ColorField label="Color de fondo (conviene oscuro)" value={draft.colorSecundario} onChange={(v) => setDraft({ ...draft, colorSecundario: v })} />
            </div>
            <Field label="Descripción" value={draft.descripcion} onChange={(v) => setDraft({ ...draft, descripcion: v })} multiline />
            <Field
              label="Mensaje si la fiesta se posterga"
              value={draft.mensajePostergado ?? ""}
              onChange={(v) => setDraft({ ...draft, mensajePostergado: v })}
              multiline
            />
            <p className="-mt-2 text-xs text-white/40">
              Se muestra en la página de la fiesta mientras las ventas están pausadas. Vacío = texto estándar.
            </p>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <label htmlFor="fiesta-venta" className="mb-1 block text-sm font-semibold text-white/80">
                Venta de la fiesta
              </label>
              <select
                id="fiesta-venta"
                value={!draft.proximamente ? "venta" : draft.ventaAbre ? "fecha" : "confirmar"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "venta") setDraft({ ...draft, proximamente: false, ventaAbre: null });
                  else if (v === "confirmar") setDraft({ ...draft, proximamente: true, ventaAbre: null });
                  else
                    setDraft({
                      ...draft,
                      proximamente: true,
                      ventaAbre: draft.ventaAbre ?? new Date(Date.now() + 7 * 864e5).toISOString(),
                    });
                }}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
              >
                <option value="venta">Abierta (se vende lo que esté &quot;A la venta&quot; en Etapas)</option>
                <option value="fecha">Próximamente · abre sola en una fecha (con cuenta regresiva)</option>
                <option value="confirmar">Próximamente · sin fecha (la abrís vos)</option>
              </select>
              {draft.proximamente && draft.ventaAbre && (
                <input
                  type="datetime-local"
                  aria-label="Fecha y hora en que abre la venta"
                  value={isoToDatetimeLocalAr(draft.ventaAbre)}
                  onChange={(e) =>
                    setDraft({ ...draft, ventaAbre: e.target.value ? `${e.target.value}:00-03:00` : draft.ventaAbre })
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none [color-scheme:dark]"
                />
              )}
              <p className="mt-2 text-xs text-white/45">
                En Próximamente la fiesta se ve en la página con su flyer, pero nadie puede comprar.
                {draft.proximamente && draft.ventaAbre ? " Abre sola cuando llega la fecha." : ""}
                {" "}Tocá &quot;Guardar cambios&quot; para aplicarlo.
              </p>
              {draft.proximamente && (
                <div className="mt-4">
                  <label htmlFor="fiesta-msg-prox" className="mb-1 block text-sm text-white/60">
                    Mensaje que ve la gente mientras está en Próximamente
                  </label>
                  <textarea
                    id="fiesta-msg-prox"
                    rows={2}
                    maxLength={300}
                    value={draft.mensajeProximamente ?? ""}
                    onChange={(e) => setDraft({ ...draft, mensajeProximamente: e.target.value })}
                    placeholder="Las entradas salen muy pronto. Volvé a entrar en unos días para comprar la tuya."
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                  />
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-white/40">Vacío = el texto de ejemplo.</p>
                    {eventos.length > 1 && (
                      <button
                        type="button"
                        onClick={copiarMensajeProximamente}
                        disabled={saving}
                        className="text-xs font-semibold text-oro underline disabled:opacity-50"
                      >
                        Usar este mensaje en las {eventos.length} fiestas
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Field label="Lugar" value={draft.lugar} onChange={(v) => setDraft({ ...draft, lugar: v })} />
            <Field label="Link de Google Maps (para el botón Cómo llegar)" value={draft.mapsUrl} onChange={(v) => setDraft({ ...draft, mapsUrl: v })} />
            <Field label="WhatsApp de esta fiesta (con código de país, ej. 5493794123456). Vacío = el de Marca" value={draft.contactoWhatsapp} onChange={(v) => setDraft({ ...draft, contactoWhatsapp: v })} />
            <Field label="Email de contacto" value={draft.contactoEmail} onChange={(v) => setDraft({ ...draft, contactoEmail: v })} />
            <Field label="Instagram (usuario)" value={draft.contactoInstagram} onChange={(v) => setDraft({ ...draft, contactoInstagram: v })} />
            <Field label="Texto al pie de la página" value={draft.textoFooter} onChange={(v) => setDraft({ ...draft, textoFooter: v })} multiline />
            <Field label="Organizador" value={draft.organizadorNombre} onChange={(v) => setDraft({ ...draft, organizadorNombre: v })} />
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 rounded-xl border border-oro/30 bg-oro/[0.06] px-4 py-3 text-sm text-white/70">
                Los precios se cargan por tipo de entrada en{" "}
                <button type="button" className="font-semibold text-oro underline" onClick={() => setTab("tipos")}>
                  Entradas y precios
                </button>
                .
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/60">Capacidad total (aforo)</label>
                <input
                  type="number"
                  value={draft.capacidad}
                  onChange={(e) => setDraft({ ...draft, capacidad: Number(e.target.value) })}
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
        {tab === "apariencia" && !draft && (
          <div className="text-white/40">
            No hay una fiesta elegida.{" "}
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
                              { label: "Anuladas / bajas", value: item.stats.canceladas },
                              { label: "Devuelto", value: formatPrecio(item.stats.reembolsado) },
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
              <h2 className="text-base font-bold">Cómo se cobra</h2>
              <p className="mt-1 text-sm text-white/60">
                El comprador paga online y recibe sus entradas al instante. La plata entra directo en tu cuenta.
              </p>
              {pagosInfo && (
                <div className="mt-4 space-y-2">
                  {[
                    { nombre: "Mercado Pago (tarjeta y dinero en cuenta)", m: pagosInfo.mp },
                    { nombre: "Talo (transferencia)", m: pagosInfo.talo },
                  ].map(({ nombre, m }) => {
                    const e = estadoMedioLabel(m);
                    return (
                      <div key={nombre} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-2.5">
                        <span className="text-sm">{nombre}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${e.clase}`}>{e.texto}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {pagosInfo?.modo?.simulate && (
                <p className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                  <strong>Simulación:</strong> en esta compu de prueba el pago se aprueba con un botón, sin cobrar nada.
                </p>
              )}
              {pagosInfo?.modo?.sandbox && (
                <p className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                  <strong>Modo prueba:</strong> la página muestra &quot;MODO PRUEBA&quot; y no se cobra de verdad. Para
                  vender, conectá la cuenta real de Mercado Pago.
                </p>
              )}
              {pagosInfo?.modo?.sinMedios && (
                <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  <strong>Todavía no se puede cobrar:</strong> nadie puede comprar hasta que conectes Mercado Pago.
                </p>
              )}
            </div>

            {pagosInfo === null ? (
              <p className="text-sm text-white/40">Cargando…</p>
            ) : (
              <ConectarMercadoPago info={pagosInfo.mp} onSaved={recargarEstadoPagos} onToast={showToast} />
            )}

            <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <summary className="cursor-pointer text-base font-bold">Opciones avanzadas</summary>
              <p className="mt-1 text-sm text-white/55">Transferencias y herramientas para probar antes de vender. No hace falta tocarlas para cobrar.</p>
              <div className="mt-5 space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h2 className="mb-2 text-base font-bold">Transferencia con Talo (opcional)</h2>
                  <p className="mb-4 text-sm text-white/60">
                    Suma el pago por transferencia. Los datos se copian de la cuenta de Talo con el mismo nombre que figura ahí.
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
                        <span className="text-sm">Aceptar transferencias (Talo)</span>
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
                        <label className="mb-1 block text-sm text-white/60">Tipo de cobro</label>
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
                          <option value="production">Cobros reales</option>
                          <option value="sandbox">Prueba (no cobra de verdad)</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                        <span className="text-sm">Estado</span>
                        {pagosInfo.talo.configured ? (
                          <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                            Conectado
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-300">
                            Sin conectar
                          </span>
                        )}
                      </div>

                      {pagosTaloTestOk === true && (
                        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                          Cuenta de Talo conectada.
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
                          {pagosTaloTestLoading ? "Verificando…" : "Verificar"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                <details className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <summary className="cursor-pointer text-base font-bold">Probar una compra sin plata real</summary>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-white/70">
                    <li>
                      En{" "}
                      <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noreferrer" className="underline">
                        Mercado Pago → Tus integraciones
                      </a>{" "}
                      → tu aplicación, elegí <strong>Prueba</strong> en el selector de arriba y copiá la clave de{" "}
                      <strong>Credenciales</strong>.
                    </li>
                    <li>Pegala arriba y tocá Guardar y verificar: tiene que decir &quot;Cuenta de prueba conectada&quot;.</li>
                    <li>
                      Comprá en la página y pagá con <strong>Tarjeta</strong>, sin iniciar sesión en Mercado Pago (usá una
                      ventana de incógnito).
                    </li>
                    <li>
                      Tarjeta de prueba: Visa <code>4509 9535 6623 3704</code> · código <code>123</code> · vence{" "}
                      <code>11/30</code> · DNI <code>12345678</code>.
                    </li>
                    <li>
                      Nombre del titular: <code>APRO</code> = pago aprobado · <code>OTHE</code> = pago rechazado.
                    </li>
                    <li>
                      Cuando Mercado Pago pida un mail, usá uno terminado en <code>@testuser.com</code> (por ejemplo{" "}
                      <code>comprador@testuser.com</code>). Con otro mail el pago de prueba falla.
                    </li>
                    <li>Al terminar: Reiniciar ventas en la fiesta y pegar la clave de la cuenta real.</li>
                  </ol>
                </details>

                <ChecklistPruebas />
              </div>
            </details>
          </div>
        )}

        {/* ── SEGURIDAD ────────────────────────────────────── */}
        {tab === "seguridad" && (
          <div className="max-w-xl space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-2 text-base font-bold">Quién puede entrar</h2>
              <p className="mb-4 text-sm text-white/60">
                Hay dos PIN: el del organizador abre este panel completo; el de puerta solo sirve para validar entradas.
              </p>
              {security === null ? (
                <p className="text-sm text-white/40">Verificando…</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-sm">PIN del organizador</span>
                    {security.adminPinDebil ? (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">
                        Es el de prueba: cambialo
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                        Seguro
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                    <span className="text-sm">PIN de puerta</span>
                    {security.scannerPinDebil ? (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">
                        Es el de prueba: cambialo
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                        Seguro
                      </span>
                    )}
                  </div>
                  {security.ambosIguales && !security.adminPinDebil && (
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
                      Los dos PIN son iguales. Usá uno para vos y otro distinto para la puerta.
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
                Cambiar los PIN
              </button>
            </div>

            {pinChangeOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-6">
                  <h2 className="mb-2 text-lg font-bold">Cambiar los PIN</h2>
                  <p className="mb-4 text-sm text-white/60">
                    Al guardar se cierra la sesión: volvé a entrar con tu PIN nuevo. Anotalos en un lugar seguro.
                  </p>
                  <form onSubmit={handleChangePins} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Tu PIN actual</label>
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
                      <label className="mb-1 block text-sm text-white/60">PIN nuevo del organizador</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.pinAdminNuevo}
                        onChange={(e) => setPinForm({ ...pinForm, pinAdminNuevo: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Repetí el PIN del organizador</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.pinAdminConfirm}
                        onChange={(e) => setPinForm({ ...pinForm, pinAdminConfirm: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/60">PIN nuevo de puerta</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinForm.pinScannerNuevo}
                        onChange={(e) => setPinForm({ ...pinForm, pinScannerNuevo: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/60">Repetí el PIN de puerta</label>
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
                    <p className="text-xs text-white/40">Al menos 6 números cada uno, y distintos entre sí.</p>
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
