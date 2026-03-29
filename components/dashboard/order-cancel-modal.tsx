"use client";

import { useEffect, useState } from "react";

import {
  ORDER_CANCELLATION_REASON_LABELS,
  ORDER_STATUS_LABELS,
} from "@/lib/orders/status-system";
import type { Order, OrderCancellationReason } from "@/types/orders";
import { ORDER_CANCELLATION_REASONS } from "@/types/orders";

interface OrderCancelModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    orderId: Order["orderId"],
    payload: {
      cancellationReason: OrderCancellationReason;
      cancellationDetail?: string | null;
    },
  ) => Promise<Order>;
}

export function OrderCancelModal({
  order,
  isOpen,
  onClose,
  onConfirm,
}: OrderCancelModalProps) {
  const [reason, setReason] = useState<OrderCancellationReason | "">("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReason("");
      setDetail("");
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
    setError("");

    if (!reason) {
      setError("Debes seleccionar un motivo de cancelación.");
      return;
    }

    const normalizedDetail = detail.trim();

    if (reason === "otro" && normalizedDetail.length === 0) {
      setError('Debes detallar la cancelación cuando el motivo es "Otro".');
      return;
    }

    if (reason !== "otro" && normalizedDetail.length > 0) {
      setError('El detalle libre solo se admite cuando el motivo es "Otro".');
      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm(currentOrder.orderId, {
        cancellationReason: reason,
        cancellationDetail: reason === "otro" ? normalizedDetail : null,
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible cancelar el pedido.",
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
          aria-labelledby="order-cancel-modal-title"
          data-testid="order-cancel-modal"
          className="w-full max-w-lg rounded-[28px] border border-rose-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">
            Salida excepcional
          </p>
          <h2 id="order-cancel-modal-title" className="mt-2 text-2xl font-semibold text-slate-950">
            Cancelar pedido
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El pedido saldrá del flujo principal y quedará en la sección de cancelados hasta que lo reactivas.
          </p>

          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{currentOrder.client}</p>
            <p className="mt-1">
              Estado actual: {ORDER_STATUS_LABELS[currentOrder.status]}
            </p>
          </div>

          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium text-slate-700">Motivo de cancelación</span>
            <select
              value={reason}
              onChange={(event) => {
                const nextReason = event.target.value as OrderCancellationReason | "";
                setReason(nextReason);
                setError("");

                if (nextReason !== "otro") {
                  setDetail("");
                }
              }}
              className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-300"
            >
              <option value="">Selecciona un motivo</option>
              {ORDER_CANCELLATION_REASONS.map((option) => (
                <option key={option} value={option}>
                  {ORDER_CANCELLATION_REASON_LABELS[option]}
                </option>
              ))}
            </select>
          </label>

          {reason === "otro" ? (
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-slate-700">Detalle adicional</span>
              <textarea
                rows={3}
                value={detail}
                onChange={(event) => {
                  setDetail(event.target.value);
                  setError("");
                }}
                placeholder="Explica el motivo de forma breve y operativa."
                className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-300"
              />
            </label>
          ) : null}

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
              className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Cancelando..." : "Confirmar cancelación"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
