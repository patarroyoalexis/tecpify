import { NextResponse } from "next/server";

import { clearActiveWorkspaceBusinessCookie } from "@/lib/auth/private-workspace";
import { signOutAuthenticatedOperator } from "@/lib/auth/operator-auth";

export async function POST() {
  await signOutAuthenticatedOperator();
  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearActiveWorkspaceBusinessCookie(response);
  return response;
}
