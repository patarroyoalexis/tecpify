import { NextResponse } from "next/server";

import {
  requireBusinessOperatorApiUser,
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

const CREATE_BUSINESS_ALLOWED_FIELDS = new Set(["name", "businessSlug", "businessType"]);
const UPDATE_BUSINESS_SETTINGS_ALLOWED_FIELDS = new Set([
  "businessSlug",
  "name",
  "businessType",
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
  business_type: string | null;
  transfer_instructions: string | null;
  accepts_cash: boolean | null;
  accepts_transfer: boolean | null;
  accepts_card: boolean | null;
  allows_fiado: boolean | null;
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

function mapBusinessRow(row: SupabaseBusinessRow): BusinessRecord {
  return {
    businessId: requireBusinessId(row.id),
    businessSlug: requireBusinessSlug(row.slug),
    name: row.name,
    businessType: row.business_type,
    transferInstructions: row.transfer_instructions,
    acceptsCash: row.accepts_cash ?? DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsCash,
    acceptsTransfer:
      row.accepts_transfer ?? DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsTransfer,
    acceptsCard: row.accepts_card ?? DEFAULT_BUSINESS_PAYMENT_SETTINGS.acceptsCard,
    allowsFiado: row.allows_fiado ?? DEFAULT_BUSINESS_PAYMENT_SETTINGS.allowsFiado,
    isActive: row.is_active,
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

  return (
    typeof candidate.name === "string" &&
    typeof candidate.businessSlug === "string" &&
    (candidate.businessType === undefined || typeof candidate.businessType === "string")
  );
}

function validateUpdateBusinessSettingsPayload(
  payload: unknown,
): payload is UpdateBusinessSettingsPayload & { name?: string; businessType?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const candidate = payload as Partial<
    UpdateBusinessSettingsPayload & { name?: string; businessType?: string }
  >;

  return (
    typeof candidate.businessSlug === "string" &&
    (candidate.name === undefined || typeof candidate.name === "string") &&
    (candidate.businessType === undefined || typeof candidate.businessType === "string") &&
    (candidate.transferInstructions === undefined ||
      typeof candidate.transferInstructions === "string") &&
    (candidate.acceptsCash === undefined || typeof candidate.acceptsCash === "boolean") &&
    (candidate.acceptsTransfer === undefined ||
      typeof candidate.acceptsTransfer === "boolean") &&
    (candidate.acceptsCard === undefined || typeof candidate.acceptsCard === "boolean") &&
    (candidate.allowsFiado === undefined || typeof candidate.allowsFiado === "boolean")
  );
}

interface BusinessesRouteDependencies {
  requireBusinessSlug: typeof requireBusinessSlug;
  requireBusinessApiContext: typeof requireBusinessApiContext;
  requireBusinessOperatorApiUser: typeof requireBusinessOperatorApiUser;
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
    requireBusinessOperatorApiUser,
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
      const authResult = await dependencies.requireBusinessOperatorApiUser(supabase);

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
      
      let finalSlug = normalizedBusinessSlug;
      let data: SupabaseBusinessRow | null = null;
      let error: any = null;

      // Intentar insertar con el slug original, si falla por colision, intentar con sufijo
      const { data: firstTryData, error: firstTryError } = await supabase
        .from("businesses")
        .insert({
          id: businessId,
          slug: finalSlug,
          name: normalizedName,
          business_type: payload.businessType || null,
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
          "id, slug, name, business_type, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, created_at, updated_at, created_by_user_id",
        )
        .single<SupabaseBusinessRow>();

      data = firstTryData;
      error = firstTryError;

      // Si falla por colision de slug, intentamos una vez mas con un sufijo corto aleatorio
      if (error && error.code === "23505" && error.message.includes("slug")) {
        const suffix = Math.random().toString(36).substring(2, 6);
        finalSlug = `${normalizedBusinessSlug}-${suffix}`;
        
        const { data: secondTryData, error: secondTryError } = await supabase
          .from("businesses")
          .insert({
            id: businessId, // Reutilizamos el mismo ID
            slug: finalSlug,
            name: normalizedName,
            business_type: payload.businessType || null,
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
            "id, slug, name, business_type, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, created_at, updated_at, created_by_user_id",
          )
          .single<SupabaseBusinessRow>();
        
        data = secondTryData;
        error = secondTryError;
      }

      if (error) {
        const statusCode = error.code === "23505" ? 409 : 500;
        const message =
          error.code === "23505"
            ? `El businessSlug "${finalSlug}" ya existe. Prueba con otro.`
            : `No fue posible crear el negocio en este momento. Revisa la configuracion de Supabase e intenta de nuevo. ${error.message}`;

        dependencies.debugError("[businesses-api] Failed to create business", {
          businessSlug: finalSlug,
          code: error.code ?? null,
          statusCode,
        });

        return NextResponse.json({ error: message }, { status: statusCode });
      }

      dependencies.debugLog("[businesses-api] Created business", {
        businessId,
        businessSlug: finalSlug,
      });

      return NextResponse.json({ business: mapBusinessRow(data!) }, { status: 201 });
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
              "Invalid business payload. businessSlug es obligatorio.",
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

      const normalizedTransferInstructions =
        payload.transferInstructions !== undefined
          ? normalizeTransferInstructions(payload.transferInstructions)
          : undefined;

      if (
        normalizedTransferInstructions !== undefined &&
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

      const normalizedName =
        payload.name !== undefined ? payload.name.trim().replace(/\s+/g, " ") : undefined;

      if (normalizedName !== undefined) {
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
      }

      const businessContextResult =
        await dependencies.requireBusinessApiContext(normalizedBusinessSlug);

      if (!businessContextResult.ok) {
        return businessContextResult.response;
      }

      const supabase = await dependencies.createServerSupabaseAuthClient();
      const now = dependencies.getNow();

      const updatePayload: any = {
        updated_at: now,
      };

      if (normalizedTransferInstructions !== undefined)
        updatePayload.transfer_instructions = normalizedTransferInstructions;
      if (payload.acceptsCash !== undefined) updatePayload.accepts_cash = payload.acceptsCash;
      if (payload.acceptsTransfer !== undefined)
        updatePayload.accepts_transfer = payload.acceptsTransfer;
      if (payload.acceptsCard !== undefined) updatePayload.accepts_card = payload.acceptsCard;
      if (payload.allowsFiado !== undefined) updatePayload.allows_fiado = payload.allowsFiado;
      if (normalizedName !== undefined) updatePayload.name = normalizedName;
      if (payload.businessType !== undefined) updatePayload.business_type = payload.businessType;

      const { data, error } = await supabase
        .from("businesses")
        .update(updatePayload)
        .eq("id", businessContextResult.context.businessId)
        .select(
          "id, slug, name, business_type, transfer_instructions, accepts_cash, accepts_transfer, accepts_card, allows_fiado, is_active, deactivated_at, created_at, updated_at, created_by_user_id",
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
      });

      return NextResponse.json({ business: mapBusinessRow(data) }, { status: 200 });
    },
    async DELETE(request: Request) {
      const supabase = await dependencies.createServerSupabaseAuthClient();
      const authResult = await dependencies.requireBusinessOperatorApiUser(supabase);

      if (!authResult.ok) {
        return authResult.response;
      }

      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body for business deactivation." },
          { status: 400 },
        );
      }

      if (!payload || typeof payload !== "object" || !("businessSlug" in payload)) {
        return NextResponse.json({ error: "El businessSlug es obligatorio." }, { status: 400 });
      }

      const businessSlug = (payload as { businessSlug: string }).businessSlug;
      const { error } = await supabase.rpc("deactivate_business", {
        target_business_slug: businessSlug,
      });

      if (error) {
        return NextResponse.json(
          { error: `No fue posible desactivar el negocio: ${error.message}` },
          { status: 500 },
        );
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    },
  };
}

const businessesRouteHandlers = createBusinessesRouteHandlers();

export const POST = businessesRouteHandlers.POST;
export const PATCH = businessesRouteHandlers.PATCH;
export const DELETE = businessesRouteHandlers.DELETE;
