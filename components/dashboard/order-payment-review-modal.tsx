"use client";

import { useEffect } from "react";

import { OrderPaymentReviewPanel } from "@/components/dashboard/order-payment-review-panel";
import type { Order, PaymentStatus } from "@/types/orders";

interface OrderPaymentReviewModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePaymentStatus: (
    orderId: Order["orderId"],
    paymentStatus: PaymentStatus,
  ) => Promise<Order>;
}

export function OrderPaymentReviewModal({
  order,
  isOpen,
  onClose,
  onUpdatePaymentStatus,
}: OrderPaymentReviewModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !order) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-950/50" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-payment-review-modal-title"
          data-testid="order-payment-review-modal"
          className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Compuerta financiera
          </p>
          <h2
            id="order-payment-review-modal-title"
            className="mt-2 text-2xl font-semibold text-slate-950"
          >
            Revisar pago
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El pago se evalua dentro de Nuevo. Solo despues de esta compuerta el pedido puede pasar a Confirmado.
          </p>

          <div className="mt-5">
            <OrderPaymentReviewPanel
              order={order}
              onUpdatePaymentStatus={onUpdatePaymentStatus}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
