import { NextResponse } from "next/server";

import {
  requireAuthenticatedApiUser,
  requireBusinessApiContext,
} from "@/lib/auth/server";
import {
  DEFAULT_BUSINESS_PAYMENT_SETTINGS,
  readBusinessPaymentSettings,
} from "@/lib/businesses/payment-settings";
import { requireBusinessSlug } from "@/lib/businesses/slug";
import { normalizeTransferInstructions } from "@/lib/businesses/transfer-instructions";
import { requireBusinessId } from "@/types/identifiers";
import { createServerSupabaseAuthClient } from "@/lib/supabase/server";
import { debugError, debugLog } from "@/lib/debug";
import type {
  BusinessRecord,
  CreateBusinessPayload,
  UpdateBusinessSettingsPayload,
} from "@/types/businesses";

const CREATE_BUSINESS_ALLOWED_FIELDS = new Set(["name", "businessSlug"]);
const UPDATE_BUSINESS_SETTINGS_ALLOWED_FIELDS = new Set([
  "businessSlug",
  "transferInstructions",
  "acceptsCash",
  "acceptsTransfer",
  "acceptsCard",
  "allowsFiado",
]);

interface SupabaseBusinessRow {
  id: string;
  slug: string;
  name: string;
  transfer_instructions: string | null;
  accepts_cash: boolean | null;
  accepts_transfer: boolean | null;
  accepts_card: boolean | null;
  allows_fiado: boolean | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

function mapBusinessRow(row: SupabaseBusinessRow): BusinessRecord {
  return {
    businessId: requireBusinessId(row.id),
    businessSlug: requireBusinessSlug(row.slug),
    name: row.name,
    transferInstructions: row.transfer_instructions,
    acceptsCash: row.accepts_cash ?? DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsCash,
    acceptsTransfer:
      row.accepts_transfer ?? DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsTransfer,
    acceptsCard: row.accepts_card ?? DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsCard,
    allowsFiado: row.allows_fiado ?? DEFAULT_BUSINESS_PAYMENT_SETTINGS.allowsFiado,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
  };
}

function validateCreateBusinessPayload(payload: unknown): payload is CreateBusinessPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Partial<CreateBusinessPayload>;

  return typeof candidate.name === "string" && typeof candidate.businessSlug === "string";
}

function validateUpdateBusinessSettingsPayload(
  payload: unknown,
): payload is UpdateBusinessSettingsPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Partial<UpdateBusinessSettingsPayload>;

  return (
    typeof candidate.businessSlug === "string" &&
    typeof candidate.transferInstructions === "string" &&
    typeof candidate.acceptsCash === "boolean" &&
    typeof candidate.acceptsTransfer === "boolean" &&
    typeof candidate.acceptsCard === "boolean" &&
    typeof candidate.allowsFiado === "boolean"
  );
}

interface BusinessesRouteDependencies {
  requireBusinessSlug: typeof requireBusinessSlug;
  requireBusinessApiContext: typeof requireBusinessApiContext;
  requireAuthenticatedApiUser: typeof requireAuthenticatedApiUser;
  createServerSupabaseAuthClient: typeof createServerSupabaseAuthClient;
  debugError: typeof debugError;
  debugLog: typeof debugLog;
  createBusinessId: () => string;
  getNow: () => string;
}

export function createBusinessesRouteHandlers(
  dependencies: BusinessesRouteDependencies = {
    requireBusinessSlug,
    requireBusinessApiContext,
    requireAuthenticatedApiUser,
    createServerSupabaseAuthClient,
    debugError,
    debugLog,
    createBusinessId: () => crypto.randomUUID(),
    getNow: () => new Date().toISOString(),
  },
) {
  return {
    async POST(request: Request) {
      const supabase = await dependencies.createServerSupabaseAuthClient();
      const authResult = await dependencies.requireAuthenticatedApiUser(supabase);

      if (!authResult.ok) {
        return authResult.response;
      }

      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body for business creation." },
          { status: 400 },
        );
      }

      if (!validateCreateBusinessPayload(payload)) {
        return NextResponse.json(
          { error: "Invalid business payload. name y businessSlug son obligatorios." },
          { status: 400 },
        );
      }

      const invalidFields = Object.keys(payload).filter(
        (field) => !CREATE_BUSINESS_ALLOWED_FIELDS.has(field),
      );

      if (invalidFields.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid business payload. Campos no permitidos: ${invalidFields.join(", ")}.`,
          },
          { status: 400 },
        );
      }

      const normalizedName = payload.name.trim().replace(/\s+/g, " ");
      let normalizedBusinessSlug: string;

      try {
        normalizedBusinessSlug = dependencies.requireBusinessSlug(payload.businessSlug);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "El businessSlug es obligatorio y debe ser un slug publico valido.",
          },
          { status: 400 },
        );
      }

      if (!normalizedName) {
        return NextResponse.json(
          { error: "El nombre del negocio es obligatorio." },
          { status: 400 },
        );
      }

      if (normalizedName.length > 80) {
        return NextResponse.json(
          { error: "El nombre del negocio no puede superar 80 caracteres." },
          { status: 400 },
        );
      }
      if (normalizedBusinessSlug.length > 60) {
        return NextResponse.json(
          { error: "El businessSlug no puede superar 60 caracteres." },
          { status: 400 },
        );
      }

      const now = dependencies.getNow();
      const businessId = dependencies.createBusinessId();
      const { data, error } = await supabase
        .from("businesses")
        .insert({
          id: businessId,
          slug: normalizedBusinessSlug,
          name: normalizedName,
          transfer_instructions: null,
          accepts_cash: DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsCash,
          accepts_transfer: DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsTransfer,
          accepts_card: DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsCard,
          allows_fiado: DEFAULT_BUSINESS_PAYMENT_SETTINGS.allowsFiado,
          created_by_user_id: authResult.user.userId,
          created_at: now,
          updated_at: now,
        })
        .select(
          "id, slug, name, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, created_at, updated_at, created_by_user_id",
        )
        .single<SupabaseBusinessRow>();

      if (error) {
        const statusCode = error.code === "23505" ? 409 : 500;
        const message =
          error.code === "23505"
            ? `El businessSlug "${normalizedBusinessSlug}" ya existe. Prueba con otro.`
            : `No fue posible crear el negocio en este momento. Revisa la configuracion de Supabase e intenta de nuevo. ${error.message}`;

        dependencies.debugError("[businesses-api] Failed to create business", {
          businessSlug: normalizedBusinessSlug,
          code: error.code ?? null,
          statusCode,
        });

        return NextResponse.json({ error: message }, { status: statusCode });
      }

      dependencies.debugLog("[businesses-api] Created business", {
        businessId,
        businessSlug: normalizedBusinessSlug,
      });

      return NextResponse.json({ business: mapBusinessRow(data) }, { status: 201 });
    },
    async PATCH(request: Request) {
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body for business update." },
          { status: 400 },
        );
      }

      if (!validateUpdateBusinessSettingsPayload(payload)) {
        return NextResponse.json(
          {
            error:
              "Invalid business payload. businessSlug, transferInstructions y los flags operativos son obligatorios.",
          },
          { status: 400 },
        );
      }

      const invalidFields = Object.keys(payload).filter(
        (field) => !UPDATE_BUSINESS_SETTINGS_ALLOWED_FIELDS.has(field),
      );

      if (invalidFields.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid business payload. Campos no permitidos: ${invalidFields.join(", ")}.`,
          },
          { status: 400 },
        );
      }

      let normalizedBusinessSlug: string;

      try {
        normalizedBusinessSlug = dependencies.requireBusinessSlug(payload.businessSlug);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "El businessSlug es obligatorio y debe ser un slug publico valido.",
          },
          { status: 400 },
        );
      }

      const normalizedTransferInstructions = normalizeTransferInstructions(
        payload.transferInstructions,
      );

      if (
        normalizedTransferInstructions !== null &&
        normalizedTransferInstructions.length > 600
      ) {
        return NextResponse.json(
          {
            error:
              "Las instrucciones de transferencia no pueden superar 600 caracteres.",
          },
          { status: 400 },
        );
      }

      const paymentSettings = readBusinessPaymentSettings(payload);

      if (
        !paymentSettings.acceptsCash &&
        !paymentSettings.acceptsTransfer &&
        !paymentSettings.acceptsCard
      ) {
        return NextResponse.json(
          {
            error:
              "Activa al menos un metodo de pago publico para el negocio.",
          },
          { status: 400 },
        );
      }

      const businessContextResult =
        await dependencies.requireBusinessApiContext(normalizedBusinessSlug);

      if (!businessContextResult.ok) {
        return businessContextResult.response;
      }

      const supabase = await dependencies.createServerSupabaseAuthClient();
      const now = dependencies.getNow();
      const { data, error } = await supabase
        .from("businesses")
        .update({
          transfer_instructions: normalizedTransferInstructions,
          accepts_cash: payload.acceptsCash,
          accepts_transfer: payload.acceptsTransfer,
          accepts_card: payload.acceptsCard,
          allows_fiado: payload.allowsFiado,
          updated_at: now,
        })
        .eq("id", businessContextResult.context.businessId)
        .select(
          "id, slug, name, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, created_at, updated_at, created_by_user_id",
        )
        .single<SupabaseBusinessRow>();

      if (error) {
        dependencies.debugError("[businesses-api] Failed to update business settings", {
          businessSlug: normalizedBusinessSlug,
          code: error.code ?? null,
        });

        return NextResponse.json(
          {
            error: `No fue posible guardar la configuracion del negocio. ${error.message}`,
          },
          { status: 500 },
        );
      }

      dependencies.debugLog("[businesses-api] Updated business settings", {
        businessSlug: normalizedBusinessSlug,
        businessId: businessContextResult.context.businessId,
        hasTransferInstructions: normalizedTransferInstructions !== null,
        acceptsCash: payload.acceptsCash,
        acceptsTransfer: payload.acceptsTransfer,
        acceptsCard: payload.acceptsCard,
        allowsFiado: payload.allowsFiado,
      });

      return NextResponse.json({ business: mapBusinessRow(data) }, { status: 200 });
    },
  };
}

const businessesRouteHandlers = createBusinessesRouteHandlers();

export const POST = businessesRouteHandlers.POST;
export const PATCH = businessesRouteHandlers.PATCH;
