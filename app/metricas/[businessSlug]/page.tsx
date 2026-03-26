import type { ComponentType } from "react";

import { BusinessWorkspaceShell } from "@/components/dashboard/business-workspace-shell";
import { MetricsOverview } from "@/components/dashboard/metrics-overview";
import { requireBusinessContext } from "@/lib/auth/server";
import { getOrdersByBusinessIdFromDatabase } from "@/lib/data/orders-server";
import {
  createMetricsPage,
  type BusinessWorkspaceShellContractProps,
} from "@/lib/page-contracts/private-business-pages";

const MetricsPage = createMetricsPage({
  requireBusinessContext,
  getOrdersByBusinessIdFromDatabase,
  BusinessWorkspaceShell:
    BusinessWorkspaceShell as ComponentType<BusinessWorkspaceShellContractProps>,
  MetricsOverview,
});

export default MetricsPage;
