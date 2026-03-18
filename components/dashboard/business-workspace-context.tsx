"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { NewOrderFormValue } from "@/components/dashboard/new-order-drawer";
import { GlobalOrderSearch } from "@/components/dashboard/global-order-search";
import { NewOrderDrawer } from "@/components/dashboard/new-order-drawer";
import { OrderDetailDrawer } from "@/components/dashboard/order-detail-drawer";
import { ProductsManagementDrawer } from "@/components/dashboard/products-management-drawer";
import { useBusinessOrders } from "@/components/dashboard/use-business-orders";
import type { Order, PaymentStatus } from "@/types/orders";
import type { OrderApiUpdatePayload } from "@/lib/orders/mappers";

interface BusinessWorkspaceProviderProps {
  businessId: string;
  businessDatabaseId: string | null;
  businessName: string;
  businessSlug: string;
  initialOrders: Order[];
  children: ReactNode;
}

interface BusinessWorkspaceContextValue {
  hasHydrated: boolean;
  newOrders: Order[];
  ordersState: Order[];
  openGlobalSearch: () => void;
  openNewOrder: () => void;
  openNewProduct: () => void;
  openOrderDetails: (orderId: string) => void;
  openProductsManager: () => void;
  handleMarkAllAsReviewed: () => void;
  handleMarkAsReviewed: (orderId: string) => void;
  handleCreateOrder: (input: NewOrderFormValue) => void;
  handleEditOrder: (
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
      | "notes"
      | "total"
    >,
  ) => Promise<Order>;
  quickUpdateOrderStatus: (orderId: string, status: Order["status"]) => Promise<void>;
  quickUpdatePaymentStatus: (
    orderId: string,
    paymentStatus: PaymentStatus,
  ) => Promise<void>;
  handleAdvanceOrderStatus: (orderId: string) => void;
  handleCancelOrder: (orderId: string) => void;
  handleConfirmOrder: (orderId: string) => void;
  handleHydrateOrder: (order: Order) => void;
  handleRequestPaymentProof: (orderId: string) => Promise<boolean>;
  handleResetOrders: () => void;
  handleUpdatePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => void;
}

const BusinessWorkspaceContext = createContext<BusinessWorkspaceContextValue | null>(null);

export function BusinessWorkspaceProvider({
  businessId,
  businessDatabaseId,
  businessName,
  businessSlug,
  initialOrders,
  children,
}: BusinessWorkspaceProviderProps) {
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isNewOrderDrawerOpen, setIsNewOrderDrawerOpen] = useState(false);
  const [isProductsDrawerOpen, setIsProductsDrawerOpen] = useState(false);
  const [productsDrawerMode, setProductsDrawerMode] = useState<"list" | "create">("list");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const {
    hasHydrated,
    newOrders,
    ordersState,
    handleAdvanceOrderStatus,
    handleCancelOrder,
    handleConfirmOrder,
    handleCreateOrder,
    handleEditOrder,
    handleHydrateOrder,
    handleMarkAllAsReviewed,
    handleMarkAsReviewed,
    handleRequestPaymentProof,
    handleResetOrders,
    handleUpdatePaymentStatus,
  } = useBusinessOrders({
    businessId,
    businessSlug,
    orders: initialOrders,
  });

  const selectedOrder = ordersState.find((order) => order.id === selectedOrderId) ?? null;

  const value = useMemo<BusinessWorkspaceContextValue>(
    () => ({
      hasHydrated,
      newOrders,
      ordersState,
      openGlobalSearch: () => setIsGlobalSearchOpen(true),
      openNewOrder: () => setIsNewOrderDrawerOpen(true),
      openNewProduct: () => {
        setProductsDrawerMode("create");
        setIsProductsDrawerOpen(true);
      },
      openOrderDetails: (orderId: string) => {
        handleMarkAsReviewed(orderId);
        setSelectedOrderId(orderId);
      },
      openProductsManager: () => {
        setProductsDrawerMode("list");
        setIsProductsDrawerOpen(true);
      },
      handleMarkAllAsReviewed,
      handleMarkAsReviewed,
      handleCreateOrder,
      handleEditOrder,
      quickUpdateOrderStatus: async (orderId, status) => {
        await handleEditOrder(orderId, { status });
      },
      quickUpdatePaymentStatus: async (orderId, paymentStatus) => {
        await handleEditOrder(orderId, { paymentStatus });
      },
      handleAdvanceOrderStatus,
      handleCancelOrder,
      handleConfirmOrder,
      handleHydrateOrder,
      handleRequestPaymentProof,
      handleResetOrders,
      handleUpdatePaymentStatus,
    }),
    [
      handleAdvanceOrderStatus,
      handleCancelOrder,
      handleConfirmOrder,
      handleCreateOrder,
      handleEditOrder,
      handleHydrateOrder,
      handleMarkAllAsReviewed,
      handleMarkAsReviewed,
      handleRequestPaymentProof,
      handleResetOrders,
      handleUpdatePaymentStatus,
      hasHydrated,
      newOrders,
      ordersState,
      setIsGlobalSearchOpen,
      setIsNewOrderDrawerOpen,
      setIsProductsDrawerOpen,
    ],
  );

  return (
    <BusinessWorkspaceContext.Provider value={value}>
      {children}

      <OrderDetailDrawer
        key={selectedOrder?.id ?? "empty"}
        businessName={businessName}
        order={selectedOrder}
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrderId(null)}
        onRequestPaymentProof={handleRequestPaymentProof}
        onUpdatePaymentStatus={handleUpdatePaymentStatus}
        onEditOrder={handleEditOrder}
        onConfirmOrder={handleConfirmOrder}
        onAdvanceOrderStatus={handleAdvanceOrderStatus}
        onCancelOrder={handleCancelOrder}
      />

      <NewOrderDrawer
        isOpen={isNewOrderDrawerOpen}
        onClose={() => setIsNewOrderDrawerOpen(false)}
        onCreateOrder={handleCreateOrder}
      />

      <ProductsManagementDrawer
        businessDatabaseId={businessDatabaseId}
        businessName={businessName}
        isOpen={isProductsDrawerOpen}
        onClose={() => setIsProductsDrawerOpen(false)}
        initialMode={productsDrawerMode}
      />

      <GlobalOrderSearch
        businessSlug={businessSlug}
        localOrders={ordersState}
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onSelectOrder={(order) => {
          handleHydrateOrder(order);
          setSelectedOrderId(order.id);
        }}
      />
    </BusinessWorkspaceContext.Provider>
  );
}

export function useBusinessWorkspace() {
  const context = useContext(BusinessWorkspaceContext);

  if (!context) {
    throw new Error("useBusinessWorkspace must be used within a BusinessWorkspaceProvider");
  }

  return context;
}
