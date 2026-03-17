import { NextResponse } from "next/server";

import { updateProductInDatabase } from "@/lib/data/products";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  const { productId } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body for product update." },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "Invalid product payload." },
      { status: 400 },
    );
  }

  try {
    const product = await updateProductInDatabase(
      productId,
      payload as Parameters<typeof updateProductInDatabase>[1],
    );
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
          : 500;

    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
