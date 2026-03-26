import { NextResponse } from "next/server";

import { requireBusinessApiContext } from "@/lib/auth/server";
import { deleteProductInDatabase, updateProductInDatabase } from "@/lib/data/products";

const PRODUCT_MUTATION_ALLOWED_FIELDS = new Set([
  "businessSlug",
  "name",
  "description",
  "price",
  "isAvailable",
  "isFeatured",
  "sortOrder",
]);

interface ProductByIdRouteDependencies {
  requireBusinessApiContext: typeof requireBusinessApiContext;
  updateProductInDatabase: typeof updateProductInDatabase;
  deleteProductInDatabase: typeof deleteProductInDatabase;
}

export function createProductByIdRouteHandlers(
  dependencies: ProductByIdRouteDependencies = {
    requireBusinessApiContext,
    updateProductInDatabase,
    deleteProductInDatabase,
  },
) {
  return {
    async PATCH(
      request: Request,
      context: { params: Promise<{ productId: string }> },
    ) {
      const { productId } = await context.params;
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "El body JSON para actualizar producto no es valido." },
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

        const product = await dependencies.updateProductInDatabase(productId, {
          ...(payload as Omit<Parameters<typeof updateProductInDatabase>[1], "businessId">),
          businessId: businessContextResult.context.businessId,
        });
        return NextResponse.json({ product }, { status: 200 });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No fue posible actualizar el producto.";
        const statusCode =
          message.startsWith("Invalid product payload.")
            ? 400
            : message.startsWith("Product not found")
              ? 404
              : message.startsWith("Ya existe")
                ? 409
                : message.startsWith("No encontramos el negocio")
                  ? 404
                  : 500;

        return NextResponse.json({ error: message }, { status: statusCode });
      }
    },
    async DELETE(
      request: Request,
      context: { params: Promise<{ productId: string }> },
    ) {
      const { productId } = await context.params;
      const { searchParams } = new URL(request.url);
      const businessSlug = searchParams.get("businessSlug")?.trim();

      if (!businessSlug) {
        return NextResponse.json(
          { error: "Debes indicar el businessSlug para borrar productos." },
          { status: 400 },
        );
      }

      const businessContextResult = await dependencies.requireBusinessApiContext(businessSlug);

      if (!businessContextResult.ok) {
        return businessContextResult.response;
      }

      try {
        const result = await dependencies.deleteProductInDatabase(
          productId,
          businessContextResult.context.businessId,
        );
        return NextResponse.json(result, { status: 200 });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No fue posible borrar el producto.";
        const statusCode =
          message.startsWith("Missing required query parameter")
            ? 400
            : message.startsWith("Product not found")
              ? 404
              : message.startsWith("No puedes borrar")
                ? 409
                : 500;

        return NextResponse.json({ error: message }, { status: statusCode });
      }
    },
  };
}

const productByIdRouteHandlers = createProductByIdRouteHandlers();

export const PATCH = productByIdRouteHandlers.PATCH;
export const DELETE = productByIdRouteHandlers.DELETE;
