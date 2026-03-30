import type { ComponentType } from "react";

import { BusinessWorkspaceShell } from "@/components/dashboard/business-workspace-shell";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { requireBusinessContext } from "@/lib/auth/server";
import { getBusinessReadinessSnapshot } from "@/lib/businesses/readiness";
import { getOwnedBusinessesForUser } from "@/data/businesses";
import { getAdminProductsByBusinessId } from "@/lib/data/products";
import { getOrdersByBusinessIdFromDatabase } from "@/lib/data/orders-server";
import {
  createBusinessDashboardPage,
  type BusinessWorkspaceShellContractProps,
  type DashboardOverviewContractProps,
} from "@/lib/page-contracts/private-business-pages";

const BusinessDashboardPage = createBusinessDashboardPage({
  requireBusinessContext,
  getBusinessReadinessSnapshot,
  getAdminProductsByBusinessId,
  getOrdersByBusinessIdFromDatabase,
  getOwnedBusinessesForUser,
  BusinessWorkspaceShell:
    BusinessWorkspaceShell as ComponentType<BusinessWorkspaceShellContractProps>,
  DashboardOverview: DashboardOverview as ComponentType<DashboardOverviewContractProps>,
});

export default BusinessDashboardPage;
