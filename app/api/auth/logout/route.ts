import { NextResponse } from "next/server";

import { clearOperatorSession } from "@/lib/auth/session";

export async function POST() {
  await clearOperatorSession();
  return NextResponse.json({ ok: true }, { status: 200 });
}
