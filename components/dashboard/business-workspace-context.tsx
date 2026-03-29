"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { NewOrderFormValue } from "@/components/dashboard/new-order-drawer";
import { GlobalOrderSearch } from "@/components/dashboard/global-order-search";
import { NewOrderDrawer } from "@/components/dashboard/new-order-drawer";
import { OrderCancelModal } from "@/components/dashboard/order-cancel-modal";
import { OrderDetailDrawer } from "@/components/dashboard/order-detail-drawer";
import { OrderReactivateModal } from "@/components/dashboard/order-reactivate-modal";
import { ProductsManagementDrawer } from "@/components/dashboard/products-management-drawer";
import { useBusinessOrders } from "@/components/dashboard/use-business-orders";
import { updateBusinessSettingsViaApi } from "@/lib/businesses/api";
import { getPublicPaymentMethodsForBusiness } from "@/lib/businesses/payment-settings";
import type {
  BusinessPaymentSettings,
  UpdateBusinessSettingsPayload,
} from "@/types/businesses";
import type { Order, PaymentMethod, PaymentStatus } from "@/types/orders";
import type { OrderApiUpdatePayload } from "@/lib/orders/mappers";

interface BusinessWorkspaceProviderProps {
  businessName: string;
  businessSlug: string;
  transferInstructions: string | null;
  acceptsCash: boolean;
  acceptsTransfer: boolean;
  acceptsCard: boolean;
  allowsFiado: boolean;
  initialOrders: Order[];
  initialOrdersError?: string | null;
  children: ReactNode;
}

interface BusinessWorkspaceContextValue {
  hasHydrated: boolean;
  newOrders: Order[];
  ordersState: Order[];
  ordersError: string | null;
  transferInstructions: string | null;
  acceptsCash: boolean;
  acceptsTransfer: boolean;
  acceptsCard: boolean;
  allowsFiado: boolean;
  availablePaymentMethods: PaymentMethod[];
  isSavingBusinessSettings: boolean;
  openGlobalSearch: () => void;
  openNewOrder: () => void;
  openNewProduct: () => void;
  openOrderDetails: (orderId: Order["orderId"]) => void;
  openCancelOrderModal: (orderId: Order["orderId"]) => void;
  openReactivateOrderModal: (orderId: Order["orderId"]) => void;
  openProductsManager: () => void;
  saveBusinessSettings: (
    payload: Pick<
      UpdateBusinessSettingsPayload,
      | "transferInstructions"
      | "acceptsCash"
      | "acceptsTransfer"
      | "acceptsCard"
      | "allowsFiado"
    >,
  ) => Promise<void>;
  handleMarkAllAsReviewed: () => void;
  handleMarkAsReviewed: (orderId: Order["orderId"]) => void;
  handleCreateOrder: (input: NewOrderFormValue) => Promise<Order>;
  handleEditOrder: (
    orderId: Order["orderId"],
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
      | "isFiado"
      | "fiadoStatus"
      | "fiadoObservation"
    >,
  ) => Promise<Order>;
  handleAdvanceOrderStatus: (orderId: Order["orderId"]) => Promise<Order | undefined>;
  handleCancelOrder: (
    orderId: Order["orderId"],
    payload: Pick<OrderApiUpdatePayload, "cancellationReason" | "cancellationDetail">,
  ) => Promise<Order>;
  handleReactivateOrder: (orderId: Order["orderId"]) => Promise<Order>;
  handleConfirmOrder: (orderId: Order["orderId"]) => Promise<Order>;
  handleHydrateOrder: (order: Order) => void;
  handleRequestPaymentProof: (orderId: Order["orderId"]) => Promise<boolean>;
  handleResetOrders: () => void;
  handleUpdatePaymentStatus: (
    orderId: Order["orderId"],
    paymentStatus: PaymentStatus,
  ) => Promise<Order>;
}

const BusinessWorkspaceContext = createContext<BusinessWorkspaceContextValue | null>(null);

interface BusinessWorkspaceSettingsState extends BusinessPaymentSettings {
  transferInstructions: string | null;
}

export function BusinessWorkspaceProvider({
  businessName,
  businessSlug,
  transferInstructions,
  acceptsCash,
  acceptsTransfer,
  acceptsCard,
  allowsFiado,
  initialOrders,
  initialOrdersError,
  children,
}: BusinessWorkspaceProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldStartProductOnboarding = searchParams.get("onboarding") === "create-product";
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isNewOrderDrawerOpen, setIsNewOrderDrawerOpen] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<BusinessWorkspaceSettingsState>({
    transferInstructions,
    acceptsCash,
    acceptsTransfer,
    acceptsCard,
    allowsFiado,
  });
  const [isSavingBusinessSettings, setIsSavingBusinessSettings] = useState(false);
  const [isProductsDrawerOpen, setIsProductsDrawerOpen] = useState(
    () => shouldStartProductOnboarding,
  );
  const [productsDrawerMode, setProductsDrawerMode] = useState<"list" | "create">(() =>
    shouldStartProductOnboarding ? "create" : "list",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<Order["orderId"] | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<Order["orderId"] | null>(null);
  const [reactivateOrderId, setReactivateOrderId] = useState<Order["orderId"] | null>(null);
  const hasHandledOnboardingIntentRef = useRef(false);
  const {
    hasHydrated,
    newOrders,
    ordersState,
    ordersError,
    handleAdvanceOrderStatus,
    handleCancelOrder,
    handleConfirmOrder,
    handleCreateOrder,
    handleEditOrder,
    handleHydrateOrder,
    handleMarkAllAsReviewed,
    handleMarkAsReviewed,
    handleReactivateOrder,
    handleRequestPaymentProof,
    handleResetOrders,
    handleUpdatePaymentStatus,
  } = useBusinessOrders({
    businessSlug,
    orders: initialOrders,
    initialOrdersError,
  });
  const businessAvailablePaymentMethods = getPublicPaymentMethodsForBusiness(businessSettings);

  const selectedOrder = ordersState.find((order) => order.orderId === selectedOrderId) ?? null;
  const orderToCancel = ordersState.find((order) => order.orderId === cancelOrderId) ?? null;
  const orderToReactivate =
    ordersState.find((order) => order.orderId === reactivateOrderId) ?? null;

  useEffect(() => {
    setBusinessSettings({
      transferInstructions,
      acceptsCash,
      acceptsTransfer,
      acceptsCard,
      allowsFiado,
    });
  }, [acceptsCard, acceptsCash, acceptsTransfer, allowsFiado, transferInstructions]);

  useEffect(() => {
    const onboardingIntent = searchParams.get("onboarding");

    if (onboardingIntent !== "create-product" || hasHandledOnboardingIntentRef.current) {
      return;
    }

    hasHandledOnboardingIntentRef.current = true;
    router.replace(pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const value = useMemo<BusinessWorkspaceContextValue>(
    () => ({
      hasHydrated,
      newOrders,
      ordersState,
      ordersError,
      transferInstructions: businessSettings.transferInstructions,
      acceptsCash: businessSettings.acceptsCash,
      acceptsTransfer: businessSettings.acceptsTransfer,
      acceptsCard: businessSettings.acceptsCard,
      allowsFiado: businessSettings.allowsFiado,
      availablePaymentMethods: businessAvailablePaymentMethods,
      isSavingBusinessSettings,
      openGlobalSearch: () => setIsGlobalSearchOpen(true),
      openNewOrder: () => setIsNewOrderDrawerOpen(true),
      openNewProduct: () => {
        setProductsDrawerMode("create");
        setIsProductsDrawerOpen(true);
      },
      openOrderDetails: (orderId: Order["orderId"]) => {
        handleMarkAsReviewed(orderId);
        setSelectedOrderId(orderId);
      },
      openCancelOrderModal: (orderId: Order["orderId"]) => {
        setCancelOrderId(orderId);
      },
      openReactivateOrderModal: (orderId: Order["orderId"]) => {
        setReactivateOrderId(orderId);
      },
      openProductsManager: () => {
        setProductsDrawerMode("list");
        setIsProductsDrawerOpen(true);
      },
      saveBusinessSettings: async (payload) => {
        setIsSavingBusinessSettings(true);

        try {
          const updatedBusiness = await updateBusinessSettingsViaApi({
            businessSlug,
            transferInstructions: payload.transferInstructions,
            acceptsCash: payload.acceptsCash,
            acceptsTransfer: payload.acceptsTransfer,
            acceptsCard: payload.acceptsCard,
            allowsFiado: payload.allowsFiado,
          });
          setBusinessSettings({
            transferInstructions: updatedBusiness.transferInstructions,
            acceptsCash: updatedBusiness.acceptsCash,
            acceptsTransfer: updatedBusiness.acceptsTransfer,
            acceptsCard: updatedBusiness.acceptsCard,
            allowsFiado: updatedBusiness.allowsFiado,
          });
        } finally {
          setIsSavingBusinessSettings(false);
        }
      },
      handleMarkAllAsReviewed,
      handleMarkAsReviewed,
      handleCreateOrder,
      handleEditOrder,
      handleAdvanceOrderStatus,
      handleCancelOrder,
      handleConfirmOrder,
      handleReactivateOrder,
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
      handleReactivateOrder,
      handleRequestPaymentProof,
      handleResetOrders,
      handleUpdatePaymentStatus,
      businessSlug,
      businessAvailablePaymentMethods,
      businessSettings,
      hasHydrated,
      isSavingBusinessSettings,
      newOrders,
      ordersError,
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
        key={selectedOrderId ?? "order-detail-drawer-closed"}
        businessName={businessName}
        transferInstructions={businessSettings.transferInstructions}
        allowsFiado={businessSettings.allowsFiado}
        order={selectedOrder}
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrderId(null)}
        onRequestPaymentProof={handleRequestPaymentProof}
        onUpdatePaymentStatus={handleUpdatePaymentStatus}
        onEditOrder={handleEditOrder}
        onConfirmOrder={handleConfirmOrder}
        onAdvanceOrderStatus={handleAdvanceOrderStatus}
        onOpenCancelOrderModal={(orderId) => setCancelOrderId(orderId)}
        onOpenReactivateOrderModal={(orderId) => setReactivateOrderId(orderId)}
      />

      <OrderCancelModal
        order={orderToCancel}
        isOpen={orderToCancel !== null}
        onClose={() => setCancelOrderId(null)}
        onConfirm={handleCancelOrder}
      />

      <OrderReactivateModal
        order={orderToReactivate}
        isOpen={orderToReactivate !== null}
        onClose={() => setReactivateOrderId(null)}
        onConfirm={handleReactivateOrder}
      />

      <NewOrderDrawer
        businessSlug={businessSlug}
        availablePaymentMethods={businessAvailablePaymentMethods}
        isOpen={isNewOrderDrawerOpen}
        onClose={() => setIsNewOrderDrawerOpen(false)}
        onCreateOrder={handleCreateOrder}
        onOpenProducts={() => {
          setIsNewOrderDrawerOpen(false);
          setProductsDrawerMode("create");
          setIsProductsDrawerOpen(true);
        }}
      />

      <ProductsManagementDrawer
        businessName={businessName}
        businessSlug={businessSlug}
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
          setSelectedOrderId(order.orderId);
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
