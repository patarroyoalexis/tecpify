import type { Order } from "@/types/orders";
import { ORDER_WORKFLOW_STATUSES } from "@/lib/orders/status-system";

export function sortOrdersForOperationalBoard(orders: Order[]) {
  return [...orders].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function splitOrdersForOperationalBoard(orders: Order[]) {
  const activeOrders = sortOrdersForOperationalBoard(
    orders.filter((order) => order.status !== "cancelado"),
  );
  const cancelledOrders = sortOrdersForOperationalBoard(
    orders.filter((order) => order.status === "cancelado"),
  );

  return {
    activeOrders,
    cancelledOrders,
    columns: ORDER_WORKFLOW_STATUSES.map((status) => ({
      status,
      orders: activeOrders.filter((order) => order.status === status),
    })),
  };
}
