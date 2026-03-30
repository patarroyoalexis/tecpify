"use client";

import { useEffect, useState } from "react";

import { OrdersBoard } from "@/components/dashboard/orders-board";
import { OrderPaymentReviewModal } from "@/components/dashboard/order-payment-review-modal";
import { isProductionRuntime } from "@/lib/runtime";
import type { Order } from "@/types/orders";
import { useBusinessWorkspace } from "./business-workspace-context";

interface OrdersWorkspaceProps {
  businessSlug: string;
}

export function OrdersWorkspace({ businessSlug }: OrdersWorkspaceProps) {
  void businessSlug;
  const [paymentReviewOrderId, setPaymentReviewOrderId] = useState<Order["orderId"] | null>(
    null,
  );
  const {
    ordersError,
    ordersState,
    handleResetOrders,
    handleAdvanceOrderStatus,
    handleConfirmOrder,
    handleMarkAsReviewed,
    handleUpdatePaymentStatus,
    openCancelOrderModal,
    openOrderDetails,
    openReactivateOrderModal,
  } = useBusinessWorkspace();
  const orderToReview =
    ordersState.find((order) => order.orderId === paymentReviewOrderId) ?? null;

  useEffect(() => {
    if (isProductionRuntime() || typeof window === "undefined") {
      return;
    }

    function handleDevelopmentReset(event: KeyboardEvent) {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleResetOrders();
      }
    }

    window.addEventListener("keydown", handleDevelopmentReset);
    return () => window.removeEventListener("keydown", handleDevelopmentReset);
  }, [handleResetOrders]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {ordersError ? (
        <div className="mb-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_12px_28px_rgba(251,191,36,0.12)]">
          {ordersError}
        </div>
      ) : null}

      <OrdersBoard
        orders={ordersState}
        onOpenDetails={openOrderDetails}
        onOpenPaymentReviewModal={(orderId) => {
          handleMarkAsReviewed(orderId);
          setPaymentReviewOrderId(orderId);
        }}
        onConfirmOrder={handleConfirmOrder}
        onAdvanceOrderStatus={handleAdvanceOrderStatus}
        onOpenCancelOrderModal={openCancelOrderModal}
        onOpenReactivateOrderModal={openReactivateOrderModal}
      />

      <OrderPaymentReviewModal
        order={orderToReview}
        isOpen={orderToReview !== null}
        onClose={() => setPaymentReviewOrderId(null)}
        onUpdatePaymentStatus={handleUpdatePaymentStatus}
      />
    </div>
  );
}
