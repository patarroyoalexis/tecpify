import { redirect } from "next/navigation";

import { resolvePrivateWorkspaceEntryFromCookies } from "@/lib/auth/private-workspace";
import { getCurrentUser } from "@/lib/auth/server";

export default async function DashboardRedirect() {
  const operator = await getCurrentUser();

  if (!operator) {
    redirect("/login?redirectTo=/dashboard");
  }

  const workspaceEntry = await resolvePrivateWorkspaceEntryFromCookies(operator.userId);

  redirect(workspaceEntry.entryHref);
}
