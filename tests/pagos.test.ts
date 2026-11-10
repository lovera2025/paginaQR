import type { PaymentResponse } from "talo-pay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { approveOrden, createOrdenPendiente, getActivity, getOrden, getTicketsByOrden } from "@/lib/db";
import { processMpPayment, processMpPaymentNotification } from "@/lib/mercadopago/payments";
import { processTaloPayment } from "@/lib/talo/payments";
import { savePaymentSettingsRow } from "@/lib/payments/settings";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T12:00:00-03:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

async function ordenPendiente(cantidad = 2) {
  const r = await createOrdenPendiente({
    eventoId: "rec-pinaroli",
    tipoEntradaId: "rec-pinaroli-anticipada",
    compradorNombre: "Comprador Test",
    compradorEmail: "test@example.com",
    cantidad,
  });
  if ("error" in r) throw new Error(r.error);
  return r.orden;
}

describe("Mercado Pago (aviso del pago)", () => {
  it("pago aprobado con credenciales de prueba → entradas emitidas y marcadas como PRUEBA", async () => {
    const orden = await ordenPendiente(2);
    const r = await processMpPayment({
      id: 111,
      status: "approved",
      external_reference: orden.id,
      transaction_amount: orden.montoTotal,
      live_mode: false,
    });
    expect(r).toEqual({ ok: true });
    const final = await getOrden(orden.id);
    expect(final?.estado).toBe("aprobado");
    expect(final?.paymentMethod).toBe("mp");
    expect(final?.paymentId).toBe("111");
    expect(final?.modoPago).toBe("sandbox");
    expect(await getTicketsByOrden(orden.id)).toHaveLength(2);
    expect((await getActivity()).some((a) => a.tipo === "pago" && a.mensaje.includes("aprobado (PRUEBA)"))).toBe(true);
  });

  it("pago real → modo producción", async () => {
    const orden = await ordenPendiente(1);
    await processMpPayment({ id: 112, status: "approved", external_reference: orden.id, transaction_amount: orden.montoTotal, live_mode: true });
    expect((await getOrden(orden.id))?.modoPago).toBe("produccion");
  });

  it("cuentas de prueba (live_mode true) con ambiente Prueba → la compra queda como PRUEBA", async () => {
    await savePaymentSettingsRow({ mp_access_token: "APP_USR-prueba", mp_environment: "sandbox", mp_enabled: true });
    try {
      const orden = await ordenPendiente(1);
      await processMpPayment({ id: 120, status: "approved", external_reference: orden.id, transaction_amount: orden.montoTotal, live_mode: true });
      expect((await getOrden(orden.id))?.modoPago).toBe("sandbox");
    } finally {
      await savePaymentSettingsRow({ mp_access_token: "", mp_environment: "production", mp_enabled: true });
    }
  });

  it("el aviso repetido no duplica entradas ni la anotación en Actividad", async () => {
    const orden = await ordenPendiente(2);
    const pago = { id: 113, status: "approved", external_reference: orden.id, transaction_amount: orden.montoTotal, live_mode: false };
    await processMpPayment(pago);
    await processMpPayment(pago);
    expect(await getTicketsByOrden(orden.id)).toHaveLength(2);
    const anotaciones = (await getActivity()).filter((a) => a.mensaje.includes(`compra ${orden.id.slice(0, 8)} → aprobado`));
    expect(anotaciones).toHaveLength(1);
  });

  it("tarjeta rechazada → la compra sigue esperando (puede probar con otra)", async () => {
    const orden = await ordenPendiente(1);
    await processMpPayment({ id: 114, status: "rejected", external_reference: orden.id });
    expect((await getOrden(orden.id))?.estado).toBe("pendiente");
    expect(await getTicketsByOrden(orden.id)).toHaveLength(0);
  });

  it("rechazada y después aprobada con otra tarjeta → entradas emitidas", async () => {
    const orden = await ordenPendiente(2);
    await processMpPayment({ id: 120, status: "rejected", external_reference: orden.id });
    await processMpPayment({ id: 121, status: "approved", external_reference: orden.id, transaction_amount: orden.montoTotal });
    expect((await getOrden(orden.id))?.estado).toBe("aprobado");
    expect(await getTicketsByOrden(orden.id)).toHaveLength(2);
  });

  it("pago cancelado → compra rechazada; si después llega uno aprobado, se reabre y emite", async () => {
    const orden = await ordenPendiente(1);
    await processMpPayment({ id: 122, status: "cancelled", external_reference: orden.id });
    expect((await getOrden(orden.id))?.estado).toBe("rechazado");
    expect(
      await processMpPayment({ id: 123, status: "approved", external_reference: orden.id, transaction_amount: orden.montoTotal })
    ).toEqual({ ok: true });
    expect((await getOrden(orden.id))?.estado).toBe("aprobado");
    expect(await getTicketsByOrden(orden.id)).toHaveLength(1);
  });

  it("si no se puede consultar el pago, pide reintentar (el aviso responde error y MP lo vuelve a mandar)", async () => {
    const r = await processMpPaymentNotification("999");
    expect("error" in r && r.reintentar).toBe(true);
  });

  it("pago pendiente → la compra sigue esperando", async () => {
    const orden = await ordenPendiente(1);
    await processMpPayment({ id: 115, status: "in_process", external_reference: orden.id });
    expect((await getOrden(orden.id))?.estado).toBe("pendiente");
  });

  it("no aprueba si el monto pagado es menor al de la compra", async () => {
    const orden = await ordenPendiente(2);
    const r = await processMpPayment({ id: 116, status: "approved", external_reference: orden.id, transaction_amount: 100 });
    expect(r).toEqual({ error: "El monto pagado no coincide con la compra" });
    expect((await getOrden(orden.id))?.estado).toBe("pendiente");
    expect(await getTicketsByOrden(orden.id)).toHaveLength(0);
  });

  it("un mismo pago no puede aprobar dos compras", async () => {
    const a = await ordenPendiente(1);
    const b = await ordenPendiente(1);
    await processMpPayment({ id: 117, status: "approved", external_reference: a.id, transaction_amount: a.montoTotal });
    const r = await processMpPayment({ id: 117, status: "approved", external_reference: b.id, transaction_amount: b.montoTotal });
    expect(r).toEqual({ error: "Pago duplicado" });
    expect((await getOrden(b.id))?.estado).toBe("pendiente");
  });

  it("pago de una compra que no existe", async () => {
    expect(await processMpPayment({ id: 118, status: "approved", external_reference: "no-existe" })).toEqual({
      error: "Orden no encontrada",
    });
    expect(await processMpPayment({ id: 119, status: "approved" })).toEqual({ error: "Pago sin external_reference" });
  });
});

describe("Talo (transferencia)", () => {
  function pagoTalo(over: Partial<PaymentResponse>): PaymentResponse {
    return { id: "talo-1", payment_status: "PENDING", ...over } as PaymentResponse;
  }

  it("transferencia acreditada con Talo en sandbox → entradas marcadas como PRUEBA", async () => {
    await savePaymentSettingsRow({ talo_user_id: "u", talo_client_id: "c", talo_client_secret: "s", environment: "sandbox", talo_enabled: true });
    const orden = await ordenPendiente(1);
    expect(await processTaloPayment(pagoTalo({ id: "talo-ok", external_id: orden.id, payment_status: "SUCCESS" }))).toEqual({ ok: true });
    const final = await getOrden(orden.id);
    expect(final?.estado).toBe("aprobado");
    expect(final?.modoPago).toBe("sandbox");
    expect(final?.paymentMethod).toBe("talo");
  });

  it("transferencia vencida → rechazada", async () => {
    const orden = await ordenPendiente(1);
    await processTaloPayment(pagoTalo({ id: "talo-exp", external_id: orden.id, payment_status: "EXPIRED" }));
    expect((await getOrden(orden.id))?.estado).toBe("rechazado");
  });

  it("transferencia que llega después de vencida → se reabre y emite", async () => {
    const orden = await ordenPendiente(1);
    await processTaloPayment(pagoTalo({ id: "talo-tarde", external_id: orden.id, payment_status: "EXPIRED" }));
    await processTaloPayment(pagoTalo({ id: "talo-tarde", external_id: orden.id, payment_status: "SUCCESS" }));
    expect((await getOrden(orden.id))?.estado).toBe("aprobado");
    expect(await getTicketsByOrden(orden.id)).toHaveLength(1);
  });

  it("transferencia con Talo en producción → modo producción", async () => {
    await savePaymentSettingsRow({ talo_user_id: "u", talo_client_id: "c", talo_client_secret: "s", environment: "production", talo_enabled: true });
    const orden = await ordenPendiente(1);
    await processTaloPayment(pagoTalo({ id: "talo-prod", external_id: orden.id, payment_status: "SUCCESS" }));
    expect((await getOrden(orden.id))?.modoPago).toBe("produccion");
  });
});

describe("pago simulado (solo local)", () => {
  it("queda marcado como simulado", async () => {
    const orden = await ordenPendiente(1);
    const r = await approveOrden(orden.id);
    if ("error" in r) throw new Error(r.error);
    expect(r.orden.modoPago).toBe("simulado");
  });
});
