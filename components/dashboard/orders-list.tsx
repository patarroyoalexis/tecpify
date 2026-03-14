import { OrderCard } from "@/components/dashboard/order-card";
import type { Order } from "@/types/orders";

interface OrdersListProps {
  orders: Order[];
  onMarkAsReviewed?: (orderId: string) => void;
}

export function OrdersList({ orders, onMarkAsReviewed }: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <section className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
        <h2 className="text-lg font-semibold text-slate-950">
          No hay pedidos en este estado
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Prueba con otro filtro para revisar el resto de la operación.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onMarkAsReviewed={onMarkAsReviewed}
        />
      ))}
    </section>
  );
}
