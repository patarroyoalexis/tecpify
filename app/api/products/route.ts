import { NextResponse } from "next/server";

import { requireBusinessApiContext } from "@/lib/auth/server";
import {
  createProductInDatabase,
  getAdminProductsByBusinessId,
} from "@/lib/data/products";

const PRODUCT_MUTATION_ALLOWED_FIELDS = new Set([
  "businessSlug",
  "name",
  "description",
  "price",
  "isAvailable",
  "isFeatured",
  "sortOrder",
]);

interface ProductsRouteDependencies {
  requireBusinessApiContext: typeof requireBusinessApiContext;
  getAdminProductsByBusinessId: typeof getAdminProductsByBusinessId;
  createProductInDatabase: typeof createProductInDatabase;
}

export function createProductsRouteHandlers(
  dependencies: ProductsRouteDependencies = {
    requireBusinessApiContext,
    getAdminProductsByBusinessId,
    createProductInDatabase,
  },
) {
  return {
    async GET(request: Request) {
      const { searchParams } = new URL(request.url);
      const businessSlug = searchParams.get("businessSlug")?.trim();

      if (!businessSlug) {
        return NextResponse.json(
          { error: "Debes indicar el businessSlug para consultar productos." },
          { status: 400 },
        );
      }

      const businessContextResult = await dependencies.requireBusinessApiContext(businessSlug);

      if (!businessContextResult.ok) {
        return businessContextResult.response;
      }

      try {
        const products = await dependencies.getAdminProductsByBusinessId(
          businessContextResult.context.businessId,
        );
        return NextResponse.json({ products });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "No fue posible consultar los productos.",
          },
          { status: 500 },
        );
      }
    },
    async POST(request: Request) {
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "El body JSON para crear producto no es valido." },
          { status: 400 },
        );
      }

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return NextResponse.json(
          { error: "El payload del producto no es valido." },
          { status: 400 },
        );
      }

      const invalidFields = Object.keys(payload).filter(
        (field) => !PRODUCT_MUTATION_ALLOWED_FIELDS.has(field),
      );

      if (invalidFields.length > 0) {
        return NextResponse.json(
          {
            error: `El payload del producto contiene campos no permitidos: ${invalidFields.join(", ")}.`,
          },
          { status: 400 },
        );
      }

      try {
        const businessSlug =
          typeof (payload as { businessSlug?: unknown }).businessSlug === "string"
            ? (payload as { businessSlug: string }).businessSlug
            : "";
        const businessContextResult = await dependencies.requireBusinessApiContext(businessSlug);

        if (!businessContextResult.ok) {
          return businessContextResult.response;
        }

        const product = await dependencies.createProductInDatabase({
          ...(payload as Omit<Parameters<typeof createProductInDatabase>[0], "businessId">),
          businessId: businessContextResult.context.businessId,
        });
        return NextResponse.json({ product }, { status: 201 });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No fue posible crear el producto.";
        const statusCode = message.startsWith("Invalid product payload.")
          ? 400
          : message.startsWith("Ya existe")
            ? 409
            : message.startsWith("No encontramos el negocio")
              ? 404
              : 500;

        return NextResponse.json({ error: message }, { status: statusCode });
      }
    },
  };
}

const productsRouteHandlers = createProductsRouteHandlers();

export const GET = productsRouteHandlers.GET;
export const POST = productsRouteHandlers.POST;
