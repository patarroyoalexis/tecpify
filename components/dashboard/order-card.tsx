import { formatCurrency, getOperationalPriority } from "@/data/orders";
import { getOrderDisplayCode, type OperationalPriority, type Order, type PaymentStatus } from "@/types/orders";

const statusStyles: Record<string, string> = {
  "pendiente de pago": "border border-amber-200 bg-amber-50 text-amber-800",
  "pago por verificar": "border border-sky-200 bg-sky-50 text-sky-800",
  confirmado: "border border-indigo-200 bg-indigo-50 text-indigo-800",
  listo: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  entregado: "border border-green-200 bg-green-50 text-green-800",
  cancelado: "border border-rose-200 bg-rose-50 text-rose-800",
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
  pendiente: "border border-amber-200 bg-amber-50 text-amber-800",
  verificado: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  "con novedad": "border border-orange-200 bg-orange-50 text-orange-800",
  "no verificado": "border border-rose-200 bg-rose-50 text-rose-800",
};

const priorityStyles: Record<OperationalPriority, { accent: string }> = {
  alta: {
    accent: "border-l-4 border-l-rose-400",
  },
  media: {
    accent: "border-l-4 border-l-amber-400",
  },
  normal: {
    accent: "",
  },
};

const orderStatusLabels: Record<string, string> = {
  "pendiente de pago": "Pendiente",
  "pago por verificar": "Por verificar",
  confirmado: "Confirmado",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  pendiente: "Pago pendiente",
  verificado: "Pago ok",
  "con novedad": "Con novedad",
  "no verificado": "No verificado",
};

interface OrderCardProps {
  order: Order;
  onOpenDetails?: (orderId: string) => void;
  compact?: boolean;
}

function getOrderStatusLabel(order: Order) {
  if (order.status.includes("prepar")) {
    return "Preparacion";
  }

  return orderStatusLabels[order.status] ?? order.status;
}

function getOrderStatusStyle(order: Order) {
  if (order.status.includes("prepar")) {
    return "border border-orange-200 bg-orange-50 text-orange-800";
  }

  return statusStyles[order.status] ?? "border border-slate-200 bg-slate-100 text-slate-700";
}

export function OrderCard({
  order,
  onOpenDetails,
  compact = false,
}: OrderCardProps) {
  const operationalPriority = getOperationalPriority(order);
  const baseCardPadding = compact ? "px-4 py-3.5" : "px-4 py-4 sm:px-5";

  return (
    <article
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      onClick={onOpenDetails ? () => onOpenDetails(order.id) : undefined}
      onKeyDown={
        onOpenDetails
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenDetails(order.id);
              }
            }
          : undefined
      }
      className={`rounded-[22px] border bg-white ${baseCardPadding} shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] active:translate-y-0 ${
        order.isReviewed
          ? "border-slate-200/80"
          : "border-rose-200 bg-rose-50/30"
      } ${priorityStyles[operationalPriority].accent} ${onOpenDetails ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2" : ""}`}
    >
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-slate-950 sm:text-base">
                {order.client}
              </h3>
              {!order.isReviewed ? (
                <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />
              ) : null}
            </div>
          </div>

          <p className="shrink-0 text-[15px] font-semibold text-slate-950 sm:text-base">
            {formatCurrency(order.total)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600">
            {getOrderDisplayCode(order)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusStyle(order)}`}
          >
            {getOrderStatusLabel(order)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${paymentStatusStyles[order.paymentStatus]}`}
          >
            {paymentStatusLabels[order.paymentStatus]}
          </span>
        </div>
      </div>
    </article>
  );
}
