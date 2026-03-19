"use client";

import { useEffect, useRef, useState } from "react";

import {
  getAvailablePaymentMethods,
  getPaymentHelpMessage,
  getPaymentMethodLabel,
  shouldShowPaymentVerificationActions,
} from "@/components/dashboard/payment-helpers";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { StatusBadgeIcon } from "@/components/dashboard/status-badge-icon";
import { formatCurrency } from "@/data/orders";
import type { OrderApiUpdatePayload } from "@/lib/orders/mappers";
import {
  canManageOrderStatus,
  getAllowedOrderStatusTransitions,
  getOrderStatusIconKey,
  getOrderStatusTransitionRule,
  getPaymentStatusIconKey,
  getPaymentStatusTransitionRule,
  isNewOrder,
  isFinalOrderStatus,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/orders/transitions";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  DELIVERY_TYPES,
  getOrderDisplayCode,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type DeliveryType,
  type Order,
  type OrderProduct,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/types/orders";

interface OrderDetailDrawerProps {
  businessName: string;
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestPaymentProof: (orderId: string) => Promise<boolean>;
  onUpdatePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => Promise<Order>;
  onEditOrder: (
    orderId: string,
    payload: Pick<
      OrderApiUpdatePayload,
      | "status"
      | "paymentStatus"
      | "customerName"
      | "customerWhatsApp"
      | "deliveryType"
      | "deliveryAddress"
      | "paymentMethod"
      | "products"
      | "notes"
      | "total"
    >,
  ) => Promise<Order>;
  onConfirmOrder: (orderId: string) => Promise<Order>;
  onAdvanceOrderStatus: (orderId: string) => Promise<Order | undefined>;
  onCancelOrder: (orderId: string) => Promise<Order>;
}

interface EditOrderFormState {
  customerName: string;
  customerWhatsApp: string;
  deliveryType: DeliveryType;
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  products: OrderProduct[];
  notes: string;
  total: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}

interface EditableProductField {
  id: string;
  productId?: string;
  name: string;
  quantity: string;
  unitPrice?: number;
}

const historyFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const orderToneStyles: Record<OrderStatus, string> = {
  "pendiente de pago": "border-sky-200 bg-sky-50 text-sky-800",
  "pago por verificar": "border-sky-200 bg-sky-50 text-sky-800",
  confirmado: "border-indigo-200 bg-indigo-50 text-indigo-800",
  "en preparación": "border-orange-200 bg-orange-50 text-orange-800",
  listo: "border-emerald-200 bg-emerald-50 text-emerald-800",
  entregado: "border-green-200 bg-green-50 text-green-800",
  cancelado: "border-rose-200 bg-rose-50 text-rose-800",
};

const paymentToneStyles: Record<PaymentStatus, string> = {
  pendiente: "border-slate-200 bg-slate-100 text-slate-700",
  verificado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "con novedad": "border-orange-200 bg-orange-50 text-orange-800",
  "no verificado": "border-rose-200 bg-rose-50 text-rose-800",
};

const DRAWER_TRANSITION_MS = 220;

function getInitialEditOrderFormState(order: Order): EditOrderFormState {
  return {
    customerName: order.client,
    customerWhatsApp: order.customerPhone ?? "",
    deliveryType: order.deliveryType,
    deliveryAddress: order.address ?? "",
    paymentMethod: order.paymentMethod,
    products: order.products,
    notes: order.observations ?? "",
    total: String(order.total),
    status: order.status,
    paymentStatus: order.paymentStatus,
  };
}

function createEditableProduct(product?: OrderProduct): EditableProductField {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    productId: product?.productId,
    name: product?.name ?? "",
    quantity: product ? String(product.quantity) : "1",
    unitPrice: product?.unitPrice,
  };
}

function getProductSummary(order: Order) {
  const totalUnits = order.products.reduce((total, product) => total + product.quantity, 0);
  const visibleProducts = order.products.slice(0, 2);
  const hiddenProductsCount = Math.max(order.products.length - visibleProducts.length, 0);

  return {
    totalUnits,
    visibleProducts,
    hiddenProductsCount,
  };
}

function getDeliveryTypeLabel(deliveryType: DeliveryType) {
  return deliveryType === "domicilio" ? "Domicilio" : "Recogida en tienda";
}

export function OrderDetailDrawer({
  businessName,
  order,
  isOpen,
  onClose,
  onRequestPaymentProof,
  onUpdatePaymentStatus,
  onEditOrder,
  onConfirmOrder,
  onAdvanceOrderStatus,
  onCancelOrder,
}: OrderDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [whatsAppFeedback, setWhatsAppFeedback] = useState("");
  const [editForm, setEditForm] = useState<EditOrderFormState | null>(null);
  const [editableProducts, setEditableProducts] = useState<EditableProductField[]>([]);
  const [renderedOrder, setRenderedOrder] = useState<Order | null>(order);
  const [isVisible, setIsVisible] = useState(false);
  const previousRenderedOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!order) {
      return;
    }

    if (renderedOrder?.id !== order.id) {
      setIsVisible(false);
    }

    setRenderedOrder(order);
  }, [order, renderedOrder?.id]);

  useEffect(() => {
    if (isOpen) {
      let nextAnimationFrame = 0;
      const animationFrame = window.requestAnimationFrame(() => {
        nextAnimationFrame = window.requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });

      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.cancelAnimationFrame(nextAnimationFrame);
      };
    }

    setIsVisible(false);

    if (!renderedOrder) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRenderedOrder(null);
    }, DRAWER_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, renderedOrder]);

  useEffect(() => {
    if (!renderedOrder) {
      setEditForm(null);
      setEditableProducts([]);
      previousRenderedOrderIdRef.current = null;
      return;
    }

    const isDifferentOrder = previousRenderedOrderIdRef.current !== renderedOrder.id;

    if (isDifferentOrder) {
      setIsEditing(false);
      setIsSaving(false);
      setEditError("");
      setEditSuccess("");
      setActionError("");
      setWhatsAppFeedback("");
    }

    if (!isEditing || isDifferentOrder) {
      const nextFormState = getInitialEditOrderFormState(renderedOrder);
      setEditForm(nextFormState);
      setEditableProducts(
        renderedOrder.products.length > 0
          ? renderedOrder.products.map((product) => createEditableProduct(product))
          : [createEditableProduct()],
      );
    }

    previousRenderedOrderIdRef.current = renderedOrder.id;
  }, [isEditing, renderedOrder]);

  if (!renderedOrder) {
    return null;
  }

  const currentOrder = renderedOrder;
  const currentEditForm = editForm ?? getInitialEditOrderFormState(currentOrder);
  const normalizedProducts = editableProducts
    .map((product) => ({
      ...(product.productId ? { productId: product.productId } : {}),
      name: product.name.trim(),
      quantity: Number(product.quantity),
      ...(product.unitPrice !== undefined ? { unitPrice: product.unitPrice } : {}),
    }))
    .filter(
      (product) =>
        product.name.length > 0 && Number.isFinite(product.quantity) && product.quantity > 0,
    );
  const sortedHistory = [...currentOrder.history].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
  const availablePaymentMethods = getAvailablePaymentMethods(currentEditForm.deliveryType);
  const effectivePaymentMethod = availablePaymentMethods.includes(currentEditForm.paymentMethod)
    ? currentEditForm.paymentMethod
    : availablePaymentMethods[0];
  const transitionContext: Order = {
    ...currentOrder,
    paymentMethod: effectivePaymentMethod,
    paymentStatus: currentEditForm.paymentStatus,
    deliveryType: currentEditForm.deliveryType,
  };
  const statusRule = getOrderStatusTransitionRule(transitionContext, currentEditForm.status);
  const paymentRule = getPaymentStatusTransitionRule(currentOrder, currentEditForm.paymentStatus);
  const totalValue = Number(currentEditForm.total);
  const paymentHelpMessage = getPaymentHelpMessage(transitionContext);
  const nextStatusByCurrent: Partial<Record<OrderStatus, OrderStatus>> = {
    confirmado: "en preparación",
    "en preparación": "listo",
    listo: "entregado",
  };
  const nextQuickStatus = nextStatusByCurrent[currentOrder.status];
  const canQuickConfirm = currentOrder.status === "pago por verificar";
  const isOrderFlowClosed = isFinalOrderStatus(currentOrder.status);
  const showNewOrderBadge = isNewOrder(currentOrder);
  const canEditOrderStatus =
    canManageOrderStatus({ paymentStatus: currentEditForm.paymentStatus }) && !isOrderFlowClosed;
  const { totalUnits, visibleProducts, hiddenProductsCount } = getProductSummary(currentOrder);
  const whatsappMessage = `Hola, te escribimos de ${businessName}. Te compartimos este mensaje por tu pedido ${getOrderDisplayCode(currentOrder)}. ¿Nos puedes enviar por favor el comprobante de pago?`;
  const whatsappUrl = buildWhatsAppUrl(currentOrder.customerPhone ?? "", whatsappMessage);
  const hasValidWhatsApp = Boolean(whatsappUrl);

  const changedFields = [
    currentEditForm.status !== currentOrder.status
      ? `Pedido: ${ORDER_STATUS_LABELS[currentOrder.status]} -> ${ORDER_STATUS_LABELS[currentEditForm.status]}`
      : "",
    currentEditForm.paymentStatus !== currentOrder.paymentStatus
      ? `Pago: ${PAYMENT_STATUS_LABELS[currentOrder.paymentStatus]} -> ${PAYMENT_STATUS_LABELS[currentEditForm.paymentStatus]}`
      : "",
    currentEditForm.customerName.trim() !== currentOrder.client.trim()
      ? "Nombre del cliente"
      : "",
    currentEditForm.customerWhatsApp.trim() !== (currentOrder.customerPhone ?? "").trim()
      ? "WhatsApp del cliente"
      : "",
    currentEditForm.deliveryType !== currentOrder.deliveryType ? "Tipo de entrega" : "",
    currentEditForm.deliveryAddress.trim() !== (currentOrder.address ?? "").trim()
      ? "Dirección de entrega"
      : "",
    effectivePaymentMethod !== currentOrder.paymentMethod ? "Método de pago" : "",
    JSON.stringify(normalizedProducts) !== JSON.stringify(currentOrder.products)
      ? "Articulos"
      : "",
    currentEditForm.notes.trim() !== (currentOrder.observations ?? "").trim() ? "Notas" : "",
    totalValue !== currentOrder.total ? "Total" : "",
  ].filter(Boolean);

  function setField<K extends keyof EditOrderFormState>(
    field: K,
    value: EditOrderFormState[K],
  ) {
    setEditError("");
    setEditSuccess("");
    setActionError("");
    setEditForm((currentValue) => {
      const nextValue = {
        ...(currentValue ?? getInitialEditOrderFormState(currentOrder)),
        [field]: value,
      };

      if (field === "deliveryType" && value === "recogida en tienda") {
        nextValue.deliveryAddress = "";
      }

      const nextPaymentMethods = getAvailablePaymentMethods(nextValue.deliveryType);

      if (!nextPaymentMethods.includes(nextValue.paymentMethod)) {
        nextValue.paymentMethod = nextPaymentMethods[0];
      }

      return nextValue;
    });
  }

  function handleEditableProductChange(
    productId: string,
    field: "name" | "quantity",
    value: string,
  ) {
    setEditError("");
    setEditSuccess("");
    setActionError("");
    setEditableProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              [field]: value,
              ...(field === "name" ? { productId: undefined, unitPrice: undefined } : {}),
            }
          : product,
      ),
    );
  }

  function handleAddProductField() {
    setEditError("");
    setEditSuccess("");
    setActionError("");
    setEditableProducts((currentProducts) => [...currentProducts, createEditableProduct()]);
  }

  function handleRemoveProductField(productId: string) {
    setEditError("");
    setEditSuccess("");
    setActionError("");
    setEditableProducts((currentProducts) =>
      currentProducts.length === 1
        ? currentProducts
        : currentProducts.filter((product) => product.id !== productId),
    );
  }

  function validateForm() {
    if (!currentEditForm.customerName.trim()) {
      return "Ingresa el nombre del cliente.";
    }

    if (normalizedProducts.length === 0) {
      return "Agrega al menos un articulo valido al pedido.";
    }

    if (!Number.isFinite(totalValue) || totalValue < 0) {
      return "Ingresa un total válido.";
    }

    if (
      currentEditForm.deliveryType === "domicilio" &&
      !currentEditForm.deliveryAddress.trim()
    ) {
      return "La dirección es obligatoria para domicilio.";
    }

    if (!statusRule.allowed) {
      return statusRule.reason ?? "Ese cambio de estado no está permitido.";
    }

    if (!paymentRule.allowed) {
      return paymentRule.reason ?? "Ese cambio de pago no está permitido.";
    }

    if (changedFields.length === 0) {
      return "No hay cambios para guardar.";
    }

    return "";
  }

  function confirmSensitiveChanges() {
    const messages = [statusRule.requiresConfirmation, paymentRule.requiresConfirmation].filter(
      Boolean,
    );

    if (messages.length === 0) {
      return true;
    }

    return window.confirm(messages.join("\n\n"));
  }

  async function handleSaveOrderChanges() {
    const validationError = validateForm();

    if (validationError) {
      setEditError(validationError);
      setEditSuccess("");
      return;
    }

    if (!confirmSensitiveChanges()) {
      return;
    }

    setIsSaving(true);
    setEditError("");
    setEditSuccess("");

    try {
      const persistedOrder = await onEditOrder(currentOrder.id, {
        status: currentEditForm.status,
        paymentStatus: currentEditForm.paymentStatus,
        customerName: currentEditForm.customerName.trim(),
        customerWhatsApp: currentEditForm.customerWhatsApp.trim() || null,
        deliveryType: currentEditForm.deliveryType,
        deliveryAddress:
          currentEditForm.deliveryType === "domicilio"
            ? currentEditForm.deliveryAddress.trim()
            : null,
        paymentMethod: effectivePaymentMethod,
        products: normalizedProducts,
        notes: currentEditForm.notes.trim() || null,
        total: totalValue,
      });
      setRenderedOrder(persistedOrder);
      setEditSuccess("Cambios guardados correctamente.");
      setIsEditing(false);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : "No fue posible guardar los cambios del pedido.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRequestPaymentByWhatsApp() {
    if (!whatsappUrl) {
      setWhatsAppFeedback("Este pedido no tiene un numero de WhatsApp valido.");
      return;
    }

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    try {
      await onRequestPaymentProof(currentOrder.id);
      setWhatsAppFeedback("Se abrio WhatsApp con el mensaje listo para enviar.");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No fue posible registrar la solicitud de comprobante.",
      );
    }
  }

  function runQuickStatusChange(nextStatus: OrderStatus) {
    const rule = getOrderStatusTransitionRule(currentOrder, nextStatus);

    if (!rule.allowed) {
      setActionError(rule.reason ?? "Ese cambio de estado no está permitido.");
      return;
    }

    if (rule.requiresConfirmation && !window.confirm(rule.requiresConfirmation)) {
      return;
    }

    setActionError("");

    if (nextStatus === "confirmado") {
      void onConfirmOrder(currentOrder.id).catch((error) => {
        setActionError(
          error instanceof Error ? error.message : "No fue posible actualizar el pedido.",
        );
      });
      return;
    }

    if (nextStatus === "cancelado") {
      void onCancelOrder(currentOrder.id).catch((error) => {
        setActionError(
          error instanceof Error ? error.message : "No fue posible actualizar el pedido.",
        );
      });
      return;
    }

    if (nextQuickStatus === nextStatus) {
      void onAdvanceOrderStatus(currentOrder.id).catch((error) => {
        setActionError(
          error instanceof Error ? error.message : "No fue posible actualizar el pedido.",
        );
      });
      return;
    }

    void onEditOrder(currentOrder.id, { status: nextStatus }).catch((error) => {
      setActionError(
        error instanceof Error ? error.message : "No fue posible actualizar el pedido.",
      );
    });
  }

  function runQuickPaymentChange(nextStatus: PaymentStatus) {
    const rule = getPaymentStatusTransitionRule(currentOrder, nextStatus);

    if (!rule.allowed) {
      setActionError(rule.reason ?? "Ese cambio de pago no está permitido.");
      return;
    }

    if (rule.requiresConfirmation && !window.confirm(rule.requiresConfirmation)) {
      return;
    }

    setActionError("");
    void onUpdatePaymentStatus(currentOrder.id, nextStatus).catch((error) => {
      setActionError(
        error instanceof Error ? error.message : "No fue posible actualizar el pago.",
      );
    });
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/30 transition-opacity duration-200 ease-out ${
          isVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={isSaving ? undefined : onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-2xl flex-col border-l border-slate-200 bg-slate-50 transition-all duration-200 ease-out will-change-transform ${
          isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        }`}
        aria-hidden={!isVisible}
      >
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-slate-950">{currentOrder.client}</h2>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Pedido {getOrderDisplayCode(currentOrder)}
                </span>
                {showNewOrderBadge ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Pedido nuevo
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <OrdersUiIcon icon="x" className="h-4 w-4" />
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-3 px-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${orderToneStyles[currentOrder.status]}`}>
                    <span className="inline-flex items-center gap-2">
                      <StatusBadgeIcon iconKey={getOrderStatusIconKey(currentOrder.status)} />
                      Pedido: {ORDER_STATUS_LABELS[currentOrder.status]}
                    </span>
                  </div>
                  <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${paymentToneStyles[currentOrder.paymentStatus]}`}>
                    <span className="inline-flex items-center gap-2">
                      <StatusBadgeIcon
                        iconKey={getPaymentStatusIconKey(currentOrder.paymentStatus)}
                      />
                      Pago: {PAYMENT_STATUS_LABELS[currentOrder.paymentStatus]}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{formatCurrency(currentOrder.total)}</span>
                  <span className="text-slate-300">•</span>
                  <span>{getDeliveryTypeLabel(currentOrder.deliveryType)}</span>
                  <span className="text-slate-300">•</span>
                  <span>{historyFormatter.format(new Date(currentOrder.createdAt))}</span>
                </div>
              </div>
              {isEditing ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditForm(getInitialEditOrderFormState(currentOrder));
                      setEditError("");
                      setEditSuccess("");
                      setIsEditing(false);
                    }}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    <OrdersUiIcon icon="x" className="h-4 w-4" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveOrderChanges()}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                  >
                    <OrdersUiIcon icon="save" className="h-4 w-4" />
                    {isSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  <OrdersUiIcon icon="edit" className="h-4 w-4" />
                  Editar pedido
                </button>
              )}
            </div>

            {editError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {editError}
              </div>
            ) : null}
            {editSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {editSuccess}
              </div>
            ) : null}

            {isEditing ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {canEditOrderStatus ? (
                  <label className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <StatusBadgeIcon iconKey={getOrderStatusIconKey(currentEditForm.status)} />
                      Estado del pedido
                    </span>
                    <select
                      value={currentEditForm.status}
                      onChange={(event) => setField("status", event.target.value as OrderStatus)}
                      disabled={isSaving}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                    >
                      {getAllowedOrderStatusTransitions(currentOrder.status).map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {ORDER_STATUS_LABELS[statusOption]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <StatusBadgeIcon iconKey={getOrderStatusIconKey(currentOrder.status)} />
                      Estado del pedido
                    </span>
                    <p className="text-sm text-slate-700">
                      Pedido: {ORDER_STATUS_LABELS[currentOrder.status]}
                    </p>
                    <p className="text-xs text-slate-500">
                      Confirma el pago para habilitar este cambio.
                    </p>
                  </div>
                )}
                <label className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <StatusBadgeIcon
                      iconKey={getPaymentStatusIconKey(currentEditForm.paymentStatus)}
                    />
                    Estado del pago
                  </span>
                  <select
                    value={currentEditForm.paymentStatus}
                    onChange={(event) =>
                      setField("paymentStatus", event.target.value as PaymentStatus)
                    }
                    disabled={isSaving}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                  >
                    {PAYMENT_STATUSES.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {PAYMENT_STATUS_LABELS[statusOption]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {isEditing ? (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Nombre del cliente</span>
                    <input
                      value={currentEditForm.customerName}
                      onChange={(event) => setField("customerName", event.target.value)}
                      disabled={isSaving}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">WhatsApp del cliente</span>
                    <input
                      value={currentEditForm.customerWhatsApp}
                      onChange={(event) => setField("customerWhatsApp", event.target.value)}
                      disabled={isSaving}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Tipo de entrega</span>
                    <select
                      value={currentEditForm.deliveryType}
                      onChange={(event) =>
                        setField("deliveryType", event.target.value as DeliveryType)
                      }
                      disabled={isSaving}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                    >
                      {DELIVERY_TYPES.map((deliveryType) => (
                        <option key={deliveryType} value={deliveryType}>
                          {deliveryType === "domicilio" ? "Domicilio" : "Recogida en tienda"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Método de pago</span>
                    <select
                      value={effectivePaymentMethod}
                      onChange={(event) =>
                        setField("paymentMethod", event.target.value as PaymentMethod)
                      }
                      disabled={isSaving}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                    >
                      {availablePaymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {getPaymentMethodLabel(method, currentEditForm.deliveryType)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Dirección de entrega</span>
                    <input
                      value={currentEditForm.deliveryAddress}
                      onChange={(event) => setField("deliveryAddress", event.target.value)}
                      disabled={isSaving || currentEditForm.deliveryType !== "domicilio"}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 disabled:bg-slate-100"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Total</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={currentEditForm.total}
                      onChange={(event) => setField("total", event.target.value)}
                      disabled={isSaving}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    />
                  </label>
                  <div className="space-y-3 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-700">Artículos</span>
                      <button
                        type="button"
                        onClick={handleAddProductField}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <OrdersUiIcon icon="plus" className="h-3.5 w-3.5" />
                        Agregar
                      </button>
                    </div>

                    <div className="space-y-3">
                      {editableProducts.map((product, index) => (
                        <div
                          key={product.id}
                          className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_120px_auto]"
                        >
                          <label className="space-y-2">
                            <span className="text-xs font-medium text-slate-600">
                              Artículo {index + 1}
                            </span>
                            <input
                              value={product.name}
                              onChange={(event) =>
                                handleEditableProductChange(
                                  product.id,
                                  "name",
                                  event.target.value,
                                )
                              }
                              disabled={isSaving}
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                              placeholder="Nombre del artículo"
                            />
                          </label>

                          <label className="space-y-2">
                            <span className="text-xs font-medium text-slate-600">Cantidad</span>
                            <input
                              type="number"
                              min="1"
                              value={product.quantity}
                              onChange={(event) =>
                                handleEditableProductChange(
                                  product.id,
                                  "quantity",
                                  event.target.value,
                                )
                              }
                              disabled={isSaving}
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                            />
                          </label>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveProductField(product.id)}
                              disabled={isSaving || editableProducts.length === 1}
                              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              <OrdersUiIcon icon="minus" className="h-3.5 w-3.5" />
                              Quitar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <label className="space-y-2 sm:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Notas</span>
                    <textarea
                      rows={4}
                      value={currentEditForm.notes}
                      onChange={(event) => setField("notes", event.target.value)}
                      disabled={isSaving}
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    />
                  </label>
                </div>

                {changedFields.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                    <p className="text-sm font-semibold text-sky-900">Cambios listos para guardar</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {changedFields.map((change) => (
                        <span
                          key={change}
                          className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700"
                        >
                          {change}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cliente</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{currentOrder.client}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">WhatsApp</p>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-medium text-slate-900">
                      {currentOrder.customerPhone ?? "Sin WhatsApp registrado"}
                    </p>
                    {hasValidWhatsApp ? (
                      <a
                        href={whatsappUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                      >
                        <OrdersUiIcon icon="clipboard" className="h-3.5 w-3.5" />
                        Abrir WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {formatCurrency(currentOrder.total)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Entrega</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {getDeliveryTypeLabel(currentOrder.deliveryType)}
                  </p>
                </div>
                {currentOrder.deliveryType === "domicilio" && currentOrder.address ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dirección</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{currentOrder.address}</p>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Método de pago</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {getPaymentMethodLabel(currentOrder.paymentMethod, currentOrder.deliveryType)}
                  </p>
                </div>
                {currentOrder.products.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Productos</p>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {totalUnits} unidad{totalUnits === 1 ? "" : "es"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {visibleProducts.map((product) => (
                        <span
                          key={`${product.name}-${product.quantity}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {product.quantity} x {product.name}
                        </span>
                      ))}
                      {hiddenProductsCount > 0 ? (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          +{hiddenProductsCount} más
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {currentOrder.observations ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Notas</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {currentOrder.observations}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </section>
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">Acciones operativas</h3>
            {actionError ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {actionError}
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Pago</p>
                <p className="mt-2 text-sm text-slate-600">{paymentHelpMessage}</p>
                <div className="mt-4 grid gap-3">
                  {shouldShowPaymentVerificationActions(currentOrder) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleRequestPaymentByWhatsApp()}
                        disabled={!hasValidWhatsApp}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-3 text-sm font-medium ${
                          hasValidWhatsApp
                            ? "border border-slate-300 bg-white text-slate-700"
                            : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                        }`}
                        title={
                          hasValidWhatsApp
                            ? "Abrir WhatsApp con el mensaje listo"
                            : "El pedido no tiene un número de WhatsApp válido"
                        }
                      >
                        <OrdersUiIcon icon="clipboard" className="h-4 w-4" />
                        Solicitar comprobante por WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => runQuickPaymentChange("verificado")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                      >
                        <OrdersUiIcon icon="save" className="h-4 w-4" />
                        Marcar pago como verificado
                      </button>
                      <button
                        type="button"
                        onClick={() => runQuickPaymentChange("con novedad")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700"
                      >
                        <OrdersUiIcon icon="edit" className="h-4 w-4" />
                        Marcar pago con novedad
                      </button>
                      <button
                        type="button"
                        onClick={() => runQuickPaymentChange("no verificado")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                      >
                        <OrdersUiIcon icon="x" className="h-4 w-4" />
                        Marcar pago como no verificado
                      </button>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      Este método de pago no requiere validación de comprobante.
                    </div>
                  )}
                  {whatsAppFeedback ? (
                    <p className="text-sm text-slate-600">{whatsAppFeedback}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Pedido</p>
                {canManageOrderStatus(currentOrder) ? (
                  <>
                    <p className="mt-2 text-sm text-slate-600">
                      Confirma, avanza o cancela sin salir del detalle.
                    </p>
                    <div className="mt-4 grid gap-3">
                      {canQuickConfirm ? (
                        <button
                          type="button"
                          onClick={() => runQuickStatusChange("confirmado")}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                        >
                          <OrdersUiIcon icon="clipboard-check" className="h-4 w-4" />
                          Confirmar pedido
                        </button>
                      ) : null}
                      {nextQuickStatus ? (
                        <button
                          type="button"
                          onClick={() => runQuickStatusChange(nextQuickStatus)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700"
                        >
                          <OrdersUiIcon icon="chevron-down" className="h-4 w-4" />
                          Avanzar a {ORDER_STATUS_LABELS[nextQuickStatus]}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => runQuickStatusChange("cancelado")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                      >
                        <OrdersUiIcon icon="x" className="h-4 w-4" />
                        Cancelar pedido
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    El estado del pedido se habilita cuando el pago queda verificado.
                  </div>
                )}
              </div>
            </div>

            {ORDER_STATUSES.some(
              (statusOption) =>
                !getOrderStatusTransitionRule(transitionContext, statusOption).allowed,
            ) ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-900">Transiciones bloqueadas</p>
                <div className="mt-2 space-y-2 text-sm text-amber-800">
                  {ORDER_STATUSES.map((statusOption) => {
                    const rule = getOrderStatusTransitionRule(transitionContext, statusOption);

                    if (rule.allowed || !rule.reason) {
                      return null;
                    }

                    return (
                      <p key={statusOption}>
                        {ORDER_STATUS_LABELS[statusOption]}: {rule.reason}
                      </p>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">Historial del pedido</h3>
            <p className="mt-1 text-sm text-slate-600">
              Cada cambio relevante deja rastro con fecha, campo y valores.
            </p>
            <div className="mt-4 space-y-4">
              {sortedHistory.map((event) => (
                <article
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{event.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                      {event.field ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                            Campo: {event.field}
                          </span>
                          {event.previousValue ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                              Antes: {event.previousValue}
                            </span>
                          ) : null}
                          {event.newValue ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                              Ahora: {event.newValue}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <time className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
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
