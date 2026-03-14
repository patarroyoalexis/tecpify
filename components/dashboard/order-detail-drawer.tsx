"use client";

import { useState } from "react";

import { formatCurrency } from "@/data/orders";
import type { Order, OrderStatus, PaymentStatus } from "@/types/orders";

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestPaymentProof: (orderId: string) => Promise<boolean>;
  onUpdatePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => void;
  onConfirmOrder: (orderId: string) => void;
  onAdvanceOrderStatus: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
}

const paymentStatusStyles: Record<PaymentStatus, string> = {
  pendiente: "border border-amber-200 bg-amber-50 text-amber-800",
  verificado: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  "con novedad": "border border-orange-200 bg-orange-50 text-orange-800",
  "no verificado": "border border-rose-200 bg-rose-50 text-rose-800",
};

const historyFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function OrderDetailDrawer({
  order,
  isOpen,
  onClose,
  onRequestPaymentProof,
  onUpdatePaymentStatus,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onCancelOrder,
}: OrderDetailDrawerProps) {
  const [whatsAppFeedback, setWhatsAppFeedback] = useState("");

  if (!order) {
    return null;
  }

  const currentOrder = order;
  const sortedHistory = [...currentOrder.history].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );

  const canConfirmOrder =
    currentOrder.paymentStatus === "verificado" &&
    (currentOrder.status === "pendiente de pago" ||
      currentOrder.status === "pago por verificar");

  const nextStatusAction: Record<
    "confirmado" | "en preparación" | "listo",
    { buttonLabel: string; nextStatus: OrderStatus }
  > = {
    confirmado: {
      buttonLabel: "Marcar en preparación",
      nextStatus: "en preparación",
    },
    "en preparación": {
      buttonLabel: "Marcar como listo",
      nextStatus: "listo",
    },
    listo: {
      buttonLabel: "Marcar como entregado",
      nextStatus: "entregado",
    },
  };

  const operationalAction =
    currentOrder.status === "confirmado" ||
    currentOrder.status === "en preparación" ||
    currentOrder.status === "listo"
      ? nextStatusAction[currentOrder.status]
      : null;

  const canCancelOrder = currentOrder.status !== "entregado";

  const confirmHelpText =
    currentOrder.paymentStatus !== "verificado"
      ? "Debes verificar el pago antes de confirmar este pedido."
      : currentOrder.status === "confirmado" ||
          currentOrder.status === "en preparación" ||
          currentOrder.status === "listo" ||
          currentOrder.status === "entregado"
        ? "Este pedido ya avanzó en el flujo operativo."
        : currentOrder.status === "cancelado"
          ? "Un pedido cancelado no puede volver a confirmarse desde esta vista."
          : "El pedido está listo para ser confirmado.";

  async function handleCopyWhatsAppMessage() {
    const message = `Hola ${currentOrder.client}, por favor envíanos el comprobante de pago del pedido ${currentOrder.id} para continuar con la validación.`;

    try {
      await navigator.clipboard.writeText(message);
      await onRequestPaymentProof(currentOrder.id);
      setWhatsAppFeedback("Mensaje listo para enviar por WhatsApp.");
    } catch {
      setWhatsAppFeedback("No fue posible copiar el mensaje automáticamente.");
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/30 transition ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.15)] transition-transform duration-200 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">{currentOrder.id}</p>
            <h2 className="text-2xl font-semibold text-slate-950">
              Detalle del pedido
            </h2>
            <p className="text-sm text-slate-600">
              Gestiona el pago y el avance del pedido sin salir del dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold text-slate-950">{currentOrder.client}</h3>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {currentOrder.status}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusStyles[currentOrder.paymentStatus]}`}
              >
                Pago {currentOrder.paymentStatus}
              </span>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Total
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-950">
                  {formatCurrency(currentOrder.total)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Fecha y hora
                </dt>
                <dd className="mt-1 text-base font-medium text-slate-900">
                  {currentOrder.dateLabel}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Método de pago
                </dt>
                <dd className="mt-1 text-base font-medium text-slate-900">
                  {currentOrder.paymentMethod}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Tipo de entrega
                </dt>
                <dd className="mt-1 text-base font-medium capitalize text-slate-900">
                  {currentOrder.deliveryType}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Estado del pedido
                </dt>
                <dd className="mt-1 text-base font-medium text-slate-900">
                  {currentOrder.status}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Estado del pago
                </dt>
                <dd className="mt-1 text-base font-medium text-slate-900">
                  {currentOrder.paymentStatus}
                </dd>
              </div>
            </dl>

            {currentOrder.observations ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">Observaciones:</span>{" "}
                {currentOrder.observations}
              </div>
            ) : null}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">Productos</h3>
            <ul className="mt-4 space-y-3">
              {currentOrder.products.map((product) => (
                <li
                  key={`${currentOrder.id}-${product.name}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <span>{product.name}</span>
                  <span className="font-semibold text-slate-900">
                    {product.quantity} unidad{product.quantity > 1 ? "es" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-950">
                Acciones rápidas
              </h3>
              <p className="text-sm text-slate-600">
                El pago se valida manualmente antes de confirmar el pedido.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCopyWhatsAppMessage}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Solicitar comprobante por WhatsApp
              </button>
              <button
                type="button"
                onClick={() => onUpdatePaymentStatus(currentOrder.id, "verificado")}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
              >
                Marcar pago como verificado
              </button>
              <button
                type="button"
                onClick={() => onUpdatePaymentStatus(currentOrder.id, "con novedad")}
                className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100"
              >
                Marcar pago con novedad
              </button>
              <button
                type="button"
                onClick={() => onUpdatePaymentStatus(currentOrder.id, "no verificado")}
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
              >
                Marcar pago como no verificado
              </button>
            </div>

            {whatsAppFeedback ? (
              <p className="mt-3 text-sm text-slate-600">{whatsAppFeedback}</p>
            ) : null}

            <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onConfirmOrder(currentOrder.id)}
                  disabled={!canConfirmOrder}
                  className={`w-full rounded-full px-4 py-3 text-sm font-medium transition ${
                    canConfirmOrder
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                  }`}
                >
                  Confirmar pedido
                </button>
                <p className="text-sm text-slate-500">{confirmHelpText}</p>
              </div>

              <div className="space-y-2">
                {operationalAction ? (
                  <button
                    type="button"
                    onClick={() => onAdvanceOrderStatus(currentOrder.id)}
                    className="w-full rounded-full border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                  >
                    {operationalAction.buttonLabel}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => onCancelOrder(currentOrder.id)}
                  disabled={!canCancelOrder}
                  className={`w-full rounded-full px-4 py-3 text-sm font-medium transition ${
                    canCancelOrder
                      ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                  }`}
                >
                  Cancelar pedido
                </button>
                {!canCancelOrder ? (
                  <p className="text-sm text-slate-500">
                    Un pedido entregado ya no puede cancelarse.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-950">
                Historial del pedido
              </h3>
              <p className="text-sm text-slate-600">
                Traza manual de eventos recientes para seguimiento operativo.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              {sortedHistory.map((event) => (
                <article
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {event.title}
                      </h4>
                      <p className="mt-1 text-sm text-slate-600">
                        {event.description}
                      </p>
                    </div>
                    <time className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      {historyFormatter.format(new Date(event.occurredAt))}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
