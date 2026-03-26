import type { ComponentType } from "react";

import { BusinessWorkspaceShell } from "@/components/dashboard/business-workspace-shell";
import { OrdersHeaderActions } from "@/components/dashboard/orders-header-actions";
import { OrdersWorkspace } from "@/components/dashboard/orders-workspace";
import { requireBusinessContext } from "@/lib/auth/server";
import { getOrdersByBusinessIdFromDatabase } from "@/lib/data/orders-server";
import {
  createOrdersPage,
  type BusinessWorkspaceShellContractProps,
} from "@/lib/page-contracts/private-business-pages";

const OrdersPage = createOrdersPage({
  requireBusinessContext,
  getOrdersByBusinessIdFromDatabase,
  BusinessWorkspaceShell:
    BusinessWorkspaceShell as ComponentType<BusinessWorkspaceShellContractProps>,
  OrdersHeaderActions,
  OrdersWorkspace,
});

export default OrdersPage;
