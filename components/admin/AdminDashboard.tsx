"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import type { ActivityLog, AdminStats, Evento, Orden, Ticket } from "@/types";
import { formatFechaCorta, formatPrecio, ticketEstadoLabel } from "@/lib/utils";

type Tab = "resumen" | "compras" | "entradas" | "apariencia" | "actividad";

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

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("resumen");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
    setEvento(e);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useAdminRealtime(refresh);

  async function handleCancel(ticketId: string) {
    if (!confirm("¿Dar de baja esta entrada?")) return;
    await fetch(`/api/admin/tickets/${ticketId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: "Baja manual admin" }),
    });
    refresh();
  }

  async function handleRefund(ordenId: string) {
    if (!confirm("¿Marcar orden como reembolsada y cancelar todas sus entradas?")) return;
    await fetch(`/api/admin/ordenes/${ordenId}/refund`, { method: "POST" });
    refresh();
  }

  async function handleSaveEvento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!evento) return;
    setSaving(true);
    await fetch("/api/admin/evento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evento),
    });
    setSaving(false);
    setMsg("Cambios guardados");
    setTimeout(() => setMsg(""), 3000);
    refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "compras", label: "Compras" },
    { id: "entradas", label: "Entradas" },
    { id: "apariencia", label: "Apariencia" },
    { id: "actividad", label: "Actividad" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/80 px-4 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin</h1>
            <p className="text-xs text-white/40">Actualización en vivo</p>
          </div>
          <div className="flex gap-2">
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
        {tab === "resumen" && stats && (
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
              <div
                key={card.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <p className="text-sm text-white/50">{card.label}</p>
                <p className="text-2xl font-black" style={{ color: card.color }}>
                  {card.value}
                </p>
              </div>
            ))}
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
                          className="text-xs text-red-400 hover:underline"
                        >
                          Reembolsar
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
                    <td className="p-3 font-mono text-xs text-white/40">
                      {t.id.slice(0, 8)}…
                    </td>
                    <td className="p-3">{t.compradorNombre}</td>
                    <td className="p-3">
                      {t.numeroEntrada}/{t.totalEntradas}
                    </td>
                    <td className="p-3">{ticketEstadoLabel(t)}</td>
                    <td className="p-3 text-white/60">
                      {t.usadoAt ? formatFechaCorta(t.usadoAt) : "—"}
                    </td>
                    <td className="p-3">
                      {!t.cancelado && !t.usado && (
                        <button
                          onClick={() => handleCancel(t.id)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Dar de baja
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

        {tab === "apariencia" && evento && (
          <form onSubmit={handleSaveEvento} className="max-w-2xl space-y-4">
            {msg && (
              <p className="rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">
                {msg}
              </p>
            )}
            <Field label="Nombre del evento" value={evento.nombre} onChange={(v) => setEvento({ ...evento, nombre: v })} />
            <Field label="URL del flyer (hero)" value={evento.flyerUrl} onChange={(v) => setEvento({ ...evento, flyerUrl: v })} />
            <Field label="URL del logo" value={evento.logoUrl} onChange={(v) => setEvento({ ...evento, logoUrl: v })} />
            <Field label="Color primario (#hex)" value={evento.colorPrimario} onChange={(v) => setEvento({ ...evento, colorPrimario: v })} />
            <Field label="Color secundario (#hex)" value={evento.colorSecundario} onChange={(v) => setEvento({ ...evento, colorSecundario: v })} />
            <Field label="Descripción" value={evento.descripcion} onChange={(v) => setEvento({ ...evento, descripcion: v })} multiline />
            <Field label="Lugar" value={evento.lugar} onChange={(v) => setEvento({ ...evento, lugar: v })} />
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
                  onChange={(e) =>
                    setEvento({ ...evento, precio: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white/60">Capacidad</label>
                <input
                  type="number"
                  value={evento.capacidad}
                  onChange={(e) =>
                    setEvento({ ...evento, capacidad: Number(e.target.value) })
                  }
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
            <p className="text-xs text-white/40">
              Fase B: upload de imágenes a Supabase Storage. Por ahora usá URLs.
            </p>
          </form>
        )}

        {tab === "actividad" && (
          <div className="space-y-2">
            {activity.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <span className="text-xs text-white/40">
                  {formatFechaCorta(a.createdAt)}
                </span>
                <span className="text-sm">{a.mensaje}</span>
              </div>
            ))}
            {activity.length === 0 && (
              <p className="text-center text-white/40">Sin actividad aún</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
