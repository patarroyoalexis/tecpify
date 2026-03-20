import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import {
  OPERATOR_SESSION_COOKIE_NAME,
  OPERATOR_SESSION_DURATION_MS,
} from "@/lib/auth/constants";

export interface OperatorSession {
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

const operatorSessionSecret = process.env.AUTH_SESSION_SECRET;
const resolvedOperatorSessionSecret =
  operatorSessionSecret ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!resolvedOperatorSessionSecret) {
  throw new Error(
    "Missing AUTH_SESSION_SECRET, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.",
  );
}

const safeOperatorSessionSecret = resolvedOperatorSessionSecret;

function signValue(value: string) {
  return createHmac("sha256", safeOperatorSessionSecret).update(value).digest("base64url");
}

function encodeSession(session: OperatorSession) {
  const encodedPayload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseSessionPayload(value: unknown): OperatorSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<OperatorSession>;

  if (
    typeof candidate.userId !== "string" ||
    candidate.userId.trim().length === 0 ||
    typeof candidate.email !== "string" ||
    candidate.email.trim().length === 0 ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.expiresAt !== "string"
  ) {
    return null;
  }

  const expiresAt = new Date(candidate.expiresAt).getTime();
  const createdAt = new Date(candidate.createdAt).getTime();

  if (!Number.isFinite(expiresAt) || !Number.isFinite(createdAt) || expiresAt <= Date.now()) {
    return null;
  }

  return {
    userId: candidate.userId,
    email: candidate.email,
    createdAt: candidate.createdAt,
    expiresAt: candidate.expiresAt,
  };
}

function decodeSession(token: string): OperatorSession | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const receivedSignatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (receivedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)) {
    return null;
  }

  try {
    const parsedPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;

    return parseSessionPayload(parsedPayload);
  } catch {
    return null;
  }
}

export function createOperatorSession(email: string, userId: string): OperatorSession {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + OPERATOR_SESSION_DURATION_MS);

  return {
    userId,
    email: email.trim().toLowerCase(),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function readOperatorSession(): Promise<OperatorSession | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(OPERATOR_SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return decodeSession(sessionToken);
}

export async function writeOperatorSession(session: OperatorSession) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: OPERATOR_SESSION_COOKIE_NAME,
    value: encodeSession(session),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
}

export async function clearOperatorSession() {
  const cookieStore = await cookies();

  cookieStore.set({
    name: OPERATOR_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
