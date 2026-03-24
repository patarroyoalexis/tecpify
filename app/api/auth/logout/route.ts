import { NextResponse } from "next/server";

import { signOutAuthenticatedOperator } from "@/lib/auth/operator-auth";

export async function POST() {
  await signOutAuthenticatedOperator();
  return NextResponse.json({ ok: true }, { status: 200 });
}
