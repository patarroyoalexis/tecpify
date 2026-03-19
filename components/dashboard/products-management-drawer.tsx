"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createProductViaApi,
  fetchProductsByBusinessId,
  updateProductViaApi,
  type ProductApiCreatePayload,
  type ProductApiUpdatePayload,
} from "@/lib/products/api";
import type { Product } from "@/types/products";

interface ProductsManagementDrawerProps {
  businessDatabaseId: string | null;
  businessName: string;
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "list" | "create";
}

interface ProductFormState {
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: string;
}

interface ProductCatalogStatus {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  canSell: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function createDefaultFormState(nextSortOrder: number): ProductFormState {
  return {
    name: "",
    description: "",
    price: "",
    isAvailable: true,
    isFeatured: false,
    sortOrder: `${nextSortOrder}`,
  };
}

function createFormStateFromProduct(product: Product): ProductFormState {
  return {
    name: product.name,
    description: product.description ?? "",
    price: `${product.price}`,
    isAvailable: product.is_available,
    isFeatured: product.is_featured,
    sortOrder: `${product.sort_order ?? 1}`,
  };
}

function ProductFlag({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "warning";
}) {
  const className =
    tone === "success"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border border-amber-200 bg-amber-50 text-amber-800"
        : "border border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function getCatalogStatus(products: Product[]): ProductCatalogStatus {
  const activeProducts = products.filter((product) => product.is_available).length;

  return {
    totalProducts: products.length,
    activeProducts,
    inactiveProducts: Math.max(products.length - activeProducts, 0),
    canSell: activeProducts > 0,
  };
}

function getAvailabilityFeedback(
  productName: string,
  isAvailable: boolean,
  catalogStatus: ProductCatalogStatus,
) {
  if (isAvailable) {
    return catalogStatus.activeProducts === 1
      ? `"${productName}" ya esta activo. El negocio ya puede vender.`
      : `"${productName}" ya esta activo. Ahora tienes ${catalogStatus.activeProducts} productos activos.`;
  }

  return catalogStatus.canSell
    ? `"${productName}" fue desactivado. Aun quedan ${catalogStatus.activeProducts} productos activos.`
    : `"${productName}" fue desactivado. El negocio se quedo sin productos activos para vender.`;
}

export function ProductsManagementDrawer({
  businessDatabaseId,
  businessName,
  isOpen,
  onClose,
  initialMode = "list",
}: ProductsManagementDrawerProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(() => createDefaultFormState(1));
  const [createAnotherAfterSave, setCreateAnotherAfterSave] = useState(true);

  const nextSortOrder = useMemo(() => {
    if (products.length === 0) {
      return 1;
    }

    return Math.max(...products.map((product) => product.sort_order ?? 0)) + 1;
  }, [products]);
  const catalogStatus = useMemo(() => getCatalogStatus(products), [products]);
  const activeProducts = useMemo(
    () => products.filter((product) => product.is_available),
    [products],
  );
  const inactiveProducts = useMemo(
    () => products.filter((product) => !product.is_available),
    [products],
  );

  const loadProducts = useCallback(async () => {
    if (!businessDatabaseId) {
      setProducts([]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const nextProducts = await fetchProductsByBusinessId(businessDatabaseId);
      setProducts(nextProducts);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar los productos.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [businessDatabaseId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadProducts();
  }, [isOpen, loadProducts]);

  useEffect(() => {
    if (!isOpen) {
      setMode(initialMode);
      setEditingProductId(null);
      setError("");
      setFeedback("");
      setFormState(createDefaultFormState(nextSortOrder));
      setCreateAnotherAfterSave(true);
    }
  }, [initialMode, isOpen, nextSortOrder]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setError("");
    setFeedback("");
    setEditingProductId(null);

    if (initialMode === "create") {
      setMode("create");
      setFormState(createDefaultFormState(nextSortOrder));
      setCreateAnotherAfterSave(true);
      return;
    }

    setMode("list");
  }, [initialMode, isOpen, nextSortOrder]);

  function updateFormField<Key extends keyof ProductFormState>(
    key: Key,
    value: ProductFormState[Key],
  ) {
    setFormState((currentState) => ({
      ...currentState,
      [key]: value,
    }));
  }

  function openCreateForm() {
    setMode("create");
    setEditingProductId(null);
    setError("");
    setFeedback("");
    setFormState(createDefaultFormState(nextSortOrder));
    setCreateAnotherAfterSave(true);
  }

  function openEditForm(product: Product) {
    setMode("edit");
    setEditingProductId(product.id);
    setError("");
    setFeedback("");
    setFormState(createFormStateFromProduct(product));
  }

  function normalizeSavePayload():
    | { create: ProductApiCreatePayload }
    | { update: ProductApiUpdatePayload } {
    const normalizedName = formState.name.trim();
    const normalizedPrice = Number(formState.price);
    const normalizedSortOrder = Number(formState.sortOrder);

    if (!normalizedName) {
      throw new Error("El nombre del producto es obligatorio.");
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      throw new Error("Ingresa un precio valido mayor o igual a 0.");
    }

    if (!Number.isFinite(normalizedSortOrder) || normalizedSortOrder < 1) {
      throw new Error("El orden debe ser un numero mayor o igual a 1.");
    }

    if (!businessDatabaseId) {
      throw new Error("Este negocio todavia no esta conectado a la base de datos.");
    }

    const sharedPayload = {
      businessId: businessDatabaseId,
      name: normalizedName,
      description: formState.description.trim(),
      price: normalizedPrice,
      isAvailable: formState.isAvailable,
      isFeatured: formState.isFeatured,
      sortOrder: normalizedSortOrder,
    };

    return mode === "edit" ? { update: sharedPayload } : { create: sharedPayload };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const payload = normalizeSavePayload();

      if ("create" in payload) {
        const createdProduct = await createProductViaApi(payload.create);
        const nextProducts = await fetchProductsByBusinessId(payload.create.businessId);
        const nextCatalogStatus = getCatalogStatus(nextProducts);

        setProducts(nextProducts);
        setFeedback(
          nextCatalogStatus.canSell
            ? `"${createdProduct.name}" ya quedo listo y el negocio puede vender.`
            : `"${createdProduct.name}" fue creado. Puedes cargar otro producto ahora.`,
        );

        router.refresh();

        if (createAnotherAfterSave) {
          setMode("create");
          setEditingProductId(null);
          setFormState(createDefaultFormState(nextProducts.length + 1));
        } else {
          setMode("list");
          setEditingProductId(null);
          setFormState(createDefaultFormState(nextProducts.length + 1));
        }
      } else if (editingProductId) {
        await updateProductViaApi(editingProductId, payload.update);
        await loadProducts();
        router.refresh();
        setFeedback("Producto actualizado correctamente.");
        setMode("list");
        setEditingProductId(null);
        setFormState(createDefaultFormState(nextSortOrder));
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar el producto.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleQuickToggle(
    product: Product,
    field: "isAvailable" | "isFeatured",
    value: boolean,
  ) {
    if (!businessDatabaseId) {
      return;
    }

    setError("");
    setFeedback("");

    try {
      await updateProductViaApi(product.id, {
        businessId: businessDatabaseId,
        [field]: value,
      });
      const nextProducts = await fetchProductsByBusinessId(businessDatabaseId);
      const nextCatalogStatus = getCatalogStatus(nextProducts);
      setProducts(nextProducts);
      router.refresh();
      setFeedback(
        field === "isAvailable"
          ? getAvailabilityFeedback(product.name, value, nextCatalogStatus)
          : value
            ? `"${product.name}" fue marcado como destacado.`
            : `"${product.name}" salio de destacados.`,
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No fue posible actualizar el producto.",
      );
    }
  }

  async function handleMove(product: Product, direction: "up" | "down") {
    if (!businessDatabaseId) {
      return;
    }

    const currentIndex = products.findIndex((item) => item.id === product.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= products.length) {
      return;
    }

    setError("");
    setFeedback("");

    try {
      await updateProductViaApi(product.id, {
        businessId: businessDatabaseId,
        sortOrder: targetIndex + 1,
      });
      await loadProducts();
      router.refresh();
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "No fue posible reordenar el producto.",
      );
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/35"
        onClick={onClose}
      />

      <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.16)] lg:max-w-5xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/96 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500">{businessName}</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {mode === "list"
                  ? "Gestionar productos"
                  : mode === "create"
                    ? "Agregar producto"
                    : "Editar producto"}
              </h2>
              <p className="text-sm text-slate-600">
                Catalogo operativo conectado a Supabase para este negocio.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {mode === "list" ? (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Agregar producto
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setEditingProductId(null);
                    setError("");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Volver
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>

          {businessDatabaseId ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {catalogStatus.totalProducts} producto
                {catalogStatus.totalProducts === 1 ? "" : "s"}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  catalogStatus.activeProducts > 0
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {catalogStatus.activeProducts} activo
                {catalogStatus.activeProducts === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {catalogStatus.inactiveProducts} inactivo
                {catalogStatus.inactiveProducts === 1 ? "" : "s"}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  catalogStatus.canSell
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {catalogStatus.canSell ? "Listo para vender" : "Aun no puede vender"}
              </span>
            </div>
          ) : null}
        </div>

        {feedback ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:px-6">
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:px-6">
            {error}
          </div>
        ) : null}

        {!businessDatabaseId ? (
          <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
            <div className="max-w-md rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-center">
              <h3 className="text-lg font-semibold text-slate-950">
                Negocio aun no conectado
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                No encontramos un `business_id` de base de datos para este negocio.
                Cuando la relacion exista, este drawer podra administrar los productos.
              </p>
            </div>
          </div>
        ) : mode === "list" ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {isLoading ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                Cargando productos...
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center">
                <h3 className="text-lg font-semibold text-slate-950">
                  Aun no hay productos cargados
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Carga entre 1 y 3 productos base para dejar el negocio listo para vender.
                </p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-4 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Crear primer producto
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className={`rounded-[22px] border p-4 text-sm ${
                    catalogStatus.canSell
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                      : "border-amber-200 bg-amber-50/80 text-amber-900"
                  }`}
                >
                  {catalogStatus.canSell
                    ? `Ya tienes ${catalogStatus.activeProducts} producto${catalogStatus.activeProducts === 1 ? "" : "s"} activo${catalogStatus.activeProducts === 1 ? "" : "s"}. El negocio ya puede vender.`
                    : `Tienes ${catalogStatus.totalProducts} producto${catalogStatus.totalProducts === 1 ? "" : "s"} cargado${catalogStatus.totalProducts === 1 ? "" : "s"}, pero aun necesitas activar al menos uno para vender.`}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          Activos
                        </p>
                        <p className="mt-1 text-sm text-emerald-900">
                          Ya aparecen en el formulario publico.
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-medium text-emerald-800">
                        {activeProducts.length}
                      </span>
                    </div>
                  </section>

                  <section className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Inactivos
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          Estan cargados, pero aun no se venden.
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700">
                        {inactiveProducts.length}
                      </span>
                    </div>
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {products.map((product, index) => (
                  <article
                    key={product.id}
                    className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-950">
                            {product.name}
                          </h3>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            Orden {product.sort_order ?? index + 1}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-900">
                          {formatCurrency(product.price)}
                        </p>
                        {product.description ? (
                          <p className="text-sm leading-6 text-slate-600">
                            {product.description}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400">Sin descripcion</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <ProductFlag
                            label={product.is_available ? "Disponible" : "No disponible"}
                            tone={product.is_available ? "success" : "neutral"}
                          />
                          <ProductFlag
                            label={product.is_featured ? "Destacado" : "Normal"}
                            tone={product.is_featured ? "warning" : "neutral"}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEditForm(product)}
                        className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-start gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickToggle(product, "isAvailable", !product.is_available)
                        }
                        className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        {product.is_available ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickToggle(product, "isFeatured", !product.is_featured)
                        }
                        className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        {product.is_featured ? "Quitar destacado" : "Destacar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(product, "up")}
                        disabled={index === 0}
                        className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                          index === 0
                            ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                            : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(product, "down")}
                        disabled={index === products.length - 1}
                        className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                          index === products.length - 1
                            ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                            : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        Bajar
                      </button>
                    </div>
                  </article>
                ))}

                  <div className="rounded-[22px] border border-amber-200 bg-amber-50/80 p-4 text-sm leading-6 text-amber-900 lg:col-span-2">
                    Por ahora priorizamos un comportamiento conservador: en lugar de borrar
                    productos, puedes desactivarlos para evitar inconsistencias futuras con
                    pedidos historicos.
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <div className="space-y-5">
                {mode === "create" ? (
                  <section className="rounded-[24px] border border-sky-200 bg-sky-50/80 p-5">
                    <p className="text-sm font-semibold text-sky-900">
                      Alta rapida para activacion
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      Para empezar a vender solo necesitas nombre, precio y dejar activo el
                      producto. La descripcion, el orden y destacado pueden esperar.
                    </p>
                  </section>
                ) : null}

                <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 sm:col-span-2">
                      <span className="text-sm font-medium text-slate-700">Nombre</span>
                      <input
                        value={formState.name}
                        onChange={(event) => updateFormField("name", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                        placeholder="Ej. Caja de brownies"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">
                        Precio
                        <span className="ml-2 text-xs font-medium text-slate-400">
                          Obligatorio
                        </span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={formState.price}
                        onChange={(event) => updateFormField("price", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                        placeholder="0"
                      />
                    </label>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">Estado inicial</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formState.isAvailable
                          ? "Activo. Se mostrara en el formulario publico."
                          : "Guardado sin activar. Aun no se mostrara en el link publico."}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Opcional para ahora</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Completa esto solo si te suma en la carga inicial.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 sm:col-span-2">
                        <span className="text-sm font-medium text-slate-700">Descripcion</span>
                        <textarea
                          value={formState.description}
                          onChange={(event) => updateFormField("description", event.target.value)}
                          rows={3}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                          placeholder="Opcional. Puedes dejarlo vacio por ahora."
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">Orden</span>
                        <input
                          type="number"
                          min="1"
                          value={formState.sortOrder}
                          onChange={(event) => updateFormField("sortOrder", event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                        />
                      </label>

                      <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Destacado</p>
                          <p className="text-sm text-slate-600">
                            Opcional para resaltar este producto.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={formState.isFeatured}
                          onChange={(event) => updateFormField("isFeatured", event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="space-y-4">
                    <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Disponible</p>
                        <p className="text-sm text-slate-600">
                          Si lo apagas, deja de aparecer en el catalogo publico.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formState.isAvailable}
                        onChange={(event) => updateFormField("isAvailable", event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                      />
                    </label>

                    {mode === "create" ? (
                      <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Seguir cargando productos
                          </p>
                          <p className="text-sm text-slate-600">
                            Despues de guardar, deja este formulario abierto para crear otro.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={createAnotherAfterSave}
                          onChange={(event) => setCreateAnotherAfterSave(event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                        />
                      </label>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white/96 px-4 py-4 backdrop-blur sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setEditingProductId(null);
                  }}
                  className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`rounded-full px-5 py-3 text-sm font-medium text-white transition ${
                    isSaving
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-slate-950 hover:bg-slate-800"
                  }`}
                >
                  {isSaving
                    ? "Guardando..."
                    : mode === "create"
                      ? createAnotherAfterSave
                        ? "Guardar y crear otro"
                        : "Crear producto"
                      : "Guardar cambios"}
                </button>
              </div>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}
