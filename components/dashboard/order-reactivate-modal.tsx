"use client";

import { useEffect, useState } from "react";

import { ORDER_STATUS_LABELS } from "@/lib/orders/status-system";
import type { Order } from "@/types/orders";

interface OrderReactivateModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (orderId: Order["orderId"]) => Promise<Order>;
}

export function OrderReactivateModal({
  order,
  isOpen,
  onClose,
  onConfirm,
}: OrderReactivateModalProps) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !order) {
    return null;
  }

  const currentOrder = order;

  async function handleSubmit() {
    if (!currentOrder.previousStatusBeforeCancellation) {
      setError(
        "No fue posible reactivar este pedido porque no tiene un estado previo válido.",
      );
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await onConfirm(currentOrder.orderId);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible reactivar el pedido.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-950/50" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-reactivate-modal-title"
          data-testid="order-reactivate-modal"
          className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">
            Reactivación
          </p>
          <h2
            id="order-reactivate-modal-title"
            className="mt-2 text-2xl font-semibold text-slate-950"
          >
            Reactivar pedido
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El pedido saldrá de cancelados y volverá exactamente al estado operativo previo guardado.
          </p>

          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{currentOrder.client}</p>
            <p className="mt-1">Estado actual: {ORDER_STATUS_LABELS.cancelado}</p>
            <p className="mt-1">
              Volverá a:{" "}
              {currentOrder.previousStatusBeforeCancellation
                ? ORDER_STATUS_LABELS[currentOrder.previousStatusBeforeCancellation]
                : "Sin estado previo válido"}
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-full border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Reactivando..." : "Confirmar reactivación"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
