"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Search,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";

import {
  getBusinessReadinessSnapshot,
  getProductCatalogTransitionFeedback,
  type BusinessReadinessSnapshot,
} from "@/lib/businesses/readiness";
import {
  createProductViaApi,
  deleteProductViaApi,
  fetchProductsByBusinessSlug,
  updateProductViaApi,
  type ProductApiCreatePayload,
  type ProductApiUpdatePayload,
} from "@/lib/products/api";
import type { Product } from "@/types/products";

interface ProductsManagementDrawerProps {
  businessName: string;
  businessSlug: string;
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

type ProductListFilter = "all" | "active" | "inactive" | "featured";
type FeedbackTone = "success" | "warning" | "info";

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
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const className =
    tone === "success"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border border-amber-200 bg-amber-50 text-amber-800"
        : tone === "danger"
          ? "border border-rose-200 bg-rose-50 text-rose-700"
        : "border border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function getReadinessFromProducts(products: Product[]): BusinessReadinessSnapshot {
  return getBusinessReadinessSnapshot(
    products.length,
    products.filter((product) => product.is_available).length,
  );
}

function matchesProductFilter(product: Product, filter: ProductListFilter) {
  if (filter === "active") {
    return product.is_available;
  }

  if (filter === "inactive") {
    return !product.is_available;
  }

  if (filter === "featured") {
    return product.is_featured;
  }

  return true;
}

function matchesProductQuery(product: Product, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return `${product.name} ${product.description ?? ""}`
    .toLowerCase()
    .includes(normalizedQuery);
}

function getProductVisibilityCopy(product: Product) {
  return product.is_available ? "Visible en el formulario publico" : "Oculto para nuevos pedidos";
}

function getProductStorefrontPositionLabel(product: Product, storefrontPosition?: number) {
  if (!product.is_available || storefrontPosition === undefined) {
    return "Fuera del storefront";
  }

  return `Posicion publica ${storefrontPosition}`;
}

function getProductOperationalTone(product: Product) {
  if (product.is_available && product.is_featured) {
    return "border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(255,255,255,1))]";
  }

  if (product.is_available) {
    return "border-sky-200 bg-[linear-gradient(135deg,rgba(240,249,255,0.92),rgba(255,255,255,1))]";
  }

  return "border-slate-200 bg-white";
}

function DeleteProductDialog({
  product,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  product: Product | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!product) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-950/50" onClick={onCancel} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
        <section className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">
            Borrado de producto
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">
            Confirmar borrado de {product.name}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Este cambio elimina el producto del catalogo del negocio. Antes de borrarlo,
            validaremos que no aparezca en pedidos ya persistidos.
          </p>
          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Si el producto ya fue usado en pedidos reales, el borrado se bloqueara y te
            pediremos desactivarlo en lugar de eliminarlo.
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white transition ${
                isDeleting
                  ? "cursor-not-allowed bg-rose-300"
                  : "bg-rose-600 hover:bg-rose-500"
              }`}
            >
              {isDeleting ? "Borrando..." : "Borrar producto"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export function ProductsManagementDrawer({
  businessName,
  businessSlug,
  isOpen,
  onClose,
  initialMode = "list",
}: ProductsManagementDrawerProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("success");
  const [mode, setMode] = useState<"list" | "create" | "edit" | "ready">("list");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Product | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(() => createDefaultFormState(1));
  const [createAnotherAfterSave, setCreateAnotherAfterSave] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState<ProductListFilter>("all");
  const publicPath = `/pedido/${businessSlug}`;
  const [publicUrl, setPublicUrl] = useState(publicPath);
  const sortedProducts = useMemo(
    () =>
      [...products].sort((left, right) => {
        const leftSortOrder = left.sort_order ?? Number.MAX_SAFE_INTEGER;
        const rightSortOrder = right.sort_order ?? Number.MAX_SAFE_INTEGER;

        if (leftSortOrder !== rightSortOrder) {
          return leftSortOrder - rightSortOrder;
        }

        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      }),
    [products],
  );

  const nextSortOrder = useMemo(() => {
    if (products.length === 0) {
      return 1;
    }

    return Math.max(...products.map((product) => product.sort_order ?? 0)) + 1;
  }, [products]);
  const catalogStatus = useMemo(() => getReadinessFromProducts(products), [products]);
  const activeProducts = useMemo(
    () => products.filter((product) => product.is_available),
    [products],
  );
  const inactiveProducts = useMemo(
    () => products.filter((product) => !product.is_available),
    [products],
  );
  const featuredProducts = useMemo(
    () => products.filter((product) => product.is_featured),
    [products],
  );
  const visibleProducts = useMemo(
    () =>
      sortedProducts.filter(
        (product) =>
          matchesProductFilter(product, listFilter) &&
          matchesProductQuery(product, searchQuery),
      ),
    [listFilter, searchQuery, sortedProducts],
  );
  const editingProduct =
    editingProductId === null
      ? null
      : products.find((product) => product.id === editingProductId) ?? null;
  const isFirstProductFlow = products.length === 0;
  const firstInactiveProduct = inactiveProducts[0] ?? null;
  const storefrontPositions = useMemo(() => {
    const positions = new Map<string, number>();
    let activeIndex = 0;

    for (const product of sortedProducts) {
      if (!product.is_available) {
        continue;
      }

      activeIndex += 1;
      positions.set(product.id, activeIndex);
    }

    return positions;
  }, [sortedProducts]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextProducts = await fetchProductsByBusinessSlug(businessSlug);
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
  }, [businessSlug]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadProducts();
  }, [isOpen, loadProducts]);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}${publicPath}`);
  }, [publicPath]);

  useEffect(() => {
    if (!isOpen) {
      setMode(initialMode);
      setEditingProductId(null);
      setDeleteCandidate(null);
      setError("");
      setFeedback("");
      setFeedbackTone("success");
      setCopyFeedback("");
      setSearchQuery("");
      setListFilter("all");
      setFormState(createDefaultFormState(nextSortOrder));
      setCreateAnotherAfterSave(!isFirstProductFlow);
    }
  }, [initialMode, isFirstProductFlow, isOpen, nextSortOrder]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setError("");
    setFeedback("");
    setFeedbackTone("success");
    setEditingProductId(null);
    setDeleteCandidate(null);
    setCopyFeedback("");

    if (initialMode === "create") {
      setMode("create");
      setFormState(createDefaultFormState(nextSortOrder));
      setCreateAnotherAfterSave(!isFirstProductFlow);
      return;
    }

    setMode("list");
  }, [initialMode, isFirstProductFlow, isOpen, nextSortOrder]);

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
    setDeleteCandidate(null);
    setError("");
    setFeedback("");
    setFeedbackTone("success");
    setCopyFeedback("");
    setFormState(createDefaultFormState(nextSortOrder));
    setCreateAnotherAfterSave(!isFirstProductFlow);
  }

  function openEditForm(product: Product) {
    setMode("edit");
    setEditingProductId(product.id);
    setDeleteCandidate(null);
    setError("");
    setFeedback("");
    setFeedbackTone("success");
    setCopyFeedback("");
    setFormState(createFormStateFromProduct(product));
  }

  async function handleCopyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyFeedback("Link publico copiado. Ya puedes compartirlo.");
    } catch {
      setCopyFeedback("No pudimos copiar el link. Intenta de nuevo.");
    }

    window.setTimeout(() => {
      setCopyFeedback("");
    }, 2400);
  }

  function showFeedback(message: string, tone: FeedbackTone = "success") {
    setFeedback(message);
    setFeedbackTone(tone);
  }

  function normalizeSavePayload():
    | { create: ProductApiCreatePayload }
    | { update: ProductApiUpdatePayload } {
    const normalizedName = formState.name.trim();
    const normalizedPrice = Number(formState.price);
    if (!normalizedName) {
      throw new Error("El nombre del producto es obligatorio.");
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      throw new Error("Ingresa un precio valido mayor o igual a 0 para crear el producto.");
    }

    const normalizedSortOrder = Number(formState.sortOrder);
    const resolvedSortOrder =
      Number.isFinite(normalizedSortOrder) && normalizedSortOrder >= 1 ? normalizedSortOrder : 1;

    const sharedPayload = {
      businessSlug,
      name: normalizedName,
      description: formState.description.trim(),
      price: normalizedPrice,
      isAvailable: formState.isAvailable,
      isFeatured: formState.isFeatured,
      sortOrder: resolvedSortOrder,
    };

    return mode === "edit" ? { update: sharedPayload } : { create: sharedPayload };
  }

  async function reloadProducts() {
    const nextProducts = await fetchProductsByBusinessSlug(businessSlug);
    setProducts(nextProducts);
    router.refresh();
    return nextProducts;
  }

  async function handleActivateProduct(product: Product) {
    await handleQuickToggle(product, "isAvailable", true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const previousCatalogStatus = getReadinessFromProducts(products);
      const payload = normalizeSavePayload();

      if ("create" in payload) {
        const createdProduct = await createProductViaApi(payload.create);
        const nextProducts = await reloadProducts();
        const nextCatalogStatus = getReadinessFromProducts(nextProducts);
        const justUnlockedSelling = !previousCatalogStatus.canSell && nextCatalogStatus.canSell;
        const createdProductIsActive = createdProduct.is_available;
        const createdProductStorefrontPosition = nextProducts
          .filter((product) => product.is_available)
          .findIndex((product) => product.id === createdProduct.id) + 1;

        if (!createdProductIsActive) {
          showFeedback(
            `"${createdProduct.name}" fue creado, pero quedo inactivo. Aun falta activarlo para que el negocio pueda vender.`,
            "warning",
          );
        } else {
          const transitionFeedback = getProductCatalogTransitionFeedback({
            previous: previousCatalogStatus,
            next: nextCatalogStatus,
            productName: createdProduct.name,
            change: "created",
          });
          const positionFeedback =
            createdProductStorefrontPosition > 0
              ? ` Quedo visible en la posicion ${createdProductStorefrontPosition} del link publico.`
              : "";
          const nextStepFeedback =
            createAnotherAfterSave && !justUnlockedSelling
              ? " Ya puedes cargar el siguiente producto sin salir del formulario."
              : "";
          showFeedback(`${transitionFeedback}${positionFeedback}${nextStepFeedback}`);
        }

        if (justUnlockedSelling) {
          setMode("ready");
          setEditingProductId(null);
          setCreateAnotherAfterSave(false);
          setFormState(createDefaultFormState(nextProducts.length + 1));
        } else if (createAnotherAfterSave) {
          setMode("create");
          setEditingProductId(null);
          setFormState(createDefaultFormState(nextProducts.length + 1));
        } else {
          setMode("list");
          setEditingProductId(null);
          setFormState(createDefaultFormState(nextProducts.length + 1));
        }
      } else if (editingProductId) {
        const updatedProduct = await updateProductViaApi(editingProductId, payload.update);
        await reloadProducts();
        showFeedback(
          `"${updatedProduct.name}" se actualizo correctamente. ${updatedProduct.is_available ? "Sigue visible" : "Quedo oculto"} en el catalogo publico.`,
          updatedProduct.is_available ? "success" : "info",
        );
        setMode("list");
        setEditingProductId(null);
        setFormState(createDefaultFormState(nextSortOrder));
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : mode === "create"
            ? "No fue posible crear el producto."
            : "No fue posible guardar los cambios del producto.",
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
    setError("");
    setFeedback("");

    if (field === "isFeatured" && value && !product.is_available) {
      setError(`Activa "${product.name}" primero para destacarlo en el storefront.`);
      return;
    }

    try {
      const previousCatalogStatus = getReadinessFromProducts(products);
      await updateProductViaApi(product.id, {
        businessSlug,
        [field]: value,
      });
      const nextProducts = await reloadProducts();
      const nextCatalogStatus = getReadinessFromProducts(nextProducts);
      const justUnlockedSelling =
        field === "isAvailable" && value && !previousCatalogStatus.canSell && nextCatalogStatus.canSell;
      showFeedback(
        field === "isAvailable"
          ? getProductCatalogTransitionFeedback({
              previous: previousCatalogStatus,
              next: nextCatalogStatus,
              productName: product.name,
              change: value ? "activated" : "deactivated",
            })
          : value
            ? `"${product.name}" fue marcado como destacado y gana visibilidad en la seleccion rapida del storefront.`
            : `"${product.name}" salio de destacados.`,
        field === "isAvailable" && !value ? "info" : "success",
      );

      if (justUnlockedSelling) {
        setMode("ready");
        setCopyFeedback("");
      }
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : field === "isAvailable"
            ? "No fue posible cambiar la disponibilidad del producto."
            : "No fue posible actualizar el destacado del producto.",
      );
    }
  }

  async function handleMove(product: Product, direction: "up" | "down") {
    const currentIndex = sortedProducts.findIndex((item) => item.id === product.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= sortedProducts.length) {
      return;
    }

    setError("");
    setFeedback("");

    try {
      await updateProductViaApi(product.id, {
        businessSlug,
        sortOrder: targetIndex + 1,
      });
      const nextProducts = await reloadProducts();
      const nextPosition =
        nextProducts.find((item) => item.id === product.id)?.sort_order ?? targetIndex + 1;
      showFeedback(`"${product.name}" ahora ocupa la posicion ${nextPosition} del catalogo.`);
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "No fue posible reordenar el producto.",
      );
    }
  }

  async function handleDeleteProduct() {
    if (!deleteCandidate) {
      return;
    }

    setIsDeleting(true);
    setError("");
    setFeedback("");

    try {
      const result = await deleteProductViaApi(deleteCandidate.id, businessSlug);
      const nextProducts = await reloadProducts();
      setDeleteCandidate(null);
      setMode("list");
      setEditingProductId(null);
      setFormState(createDefaultFormState(nextProducts.length + 1));
      showFeedback(`"${result.deletedProduct.name}" fue borrado del catalogo. El orden se renormalizo automaticamente.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible borrar el producto.",
      );
      setDeleteCandidate(null);
    } finally {
      setIsDeleting(false);
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
                    ? isFirstProductFlow
                      ? "Crear primer producto"
                      : "Agregar producto"
                    : mode === "ready"
                      ? "Listo para vender"
                    : "Editar producto"}
              </h2>
              <p className="text-sm text-slate-600">
                {isFirstProductFlow && mode === "create"
                  ? "Lo minimo para destrabar ventas: nombre, precio y dejarlo activo."
                  : "Catalogo operativo conectado a Supabase para este negocio."}
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
                    setDeleteCandidate(null);
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
        </div>

        {feedback ? (
          <div
            className={`border-b px-4 py-3 text-sm sm:px-6 ${
              feedbackTone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : feedbackTone === "info"
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:px-6">
            {error}
          </div>
        ) : null}

        {mode === "ready" ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="mx-auto max-w-3xl space-y-5">
              <section className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Activacion completada
                </p>
                <h3 className="mt-2 text-3xl font-semibold text-slate-950">
                  El negocio ya puede recibir pedidos
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Acabas de dejar al menos un producto activo. No hace falta volver al
                  dashboard para seguir: desde aqui ya puedes abrir el storefront o copiar
                  el link correcto para compartirlo. El mejor siguiente paso es validar el
                  recorrido real del negocio.
                </p>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Link publico del negocio
                </p>
                <p className="mt-2 break-all text-sm font-medium text-slate-950">{publicUrl}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Usa este link para abrir el formulario publico real o para compartirlo con
                  el negocio una vez validado.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => void handleCopyPublicLink()}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copiar link publico
                  </button>

                  <Link
                    href={publicPath}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Abrir formulario publico
                  </Link>
                </div>

                {copyFeedback ? (
                  <p className="mt-3 text-sm text-slate-600">{copyFeedback}</p>
                ) : null}
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                <p className="text-sm font-semibold text-slate-950">Siguiente paso recomendado</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  1. Abre el formulario publico real. 2. Crea un pedido corto para
                  verificar que entre bien al flujo. 3. Luego comparte el link o vuelve al
                  catalogo para seguir ajustandolo.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMode("list")}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Seguir gestionando productos
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Volver al dashboard
                  </button>
                </div>
              </section>
            </div>
          </div>
        ) : mode === "list" ? (
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {isLoading ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                Cargando productos...
              </div>
            ) : products.length === 0 ? (
              <section className="rounded-[28px] border border-dashed border-sky-300 bg-[linear-gradient(135deg,rgba(240,249,255,0.98),rgba(255,255,255,0.98))] p-6 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-800">
                  Catalogo inicial
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  Este negocio todavia no puede vender
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Lo unico que falta para destrabar el flujo es crear el primer producto.
                  Hazlo ahora con nombre, precio y disponibilidad. Si lo dejas activo, el
                  negocio queda listo para compartir su link.
                </p>
                <div className="mt-4 rounded-[20px] border border-sky-200 bg-white/90 p-4 text-left text-sm leading-6 text-slate-700">
                  Paso minimo para salir del bloqueo: crear 1 producto y dejarlo activo.
                </div>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-5 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Crear primer producto
                </button>
              </section>
            ) : (
              <div className="space-y-4">
                <section className="grid gap-4 lg:grid-cols-4">
                  <article className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Total
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{products.length}</p>
                    <p className="mt-1 text-sm text-slate-600">Productos cargados en el catalogo.</p>
                  </article>
                  <article className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      Activos
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{activeProducts.length}</p>
                    <p className="mt-1 text-sm text-emerald-900">Ya se muestran en el storefront.</p>
                  </article>
                  <article className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Inactivos
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{inactiveProducts.length}</p>
                    <p className="mt-1 text-sm text-slate-700">Quedan fuera del link publico.</p>
                  </article>
                  <article className="rounded-[22px] border border-amber-200 bg-amber-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                      Destacados
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{featuredProducts.length}</p>
                    <p className="mt-1 text-sm text-amber-900">Priorizados en la seleccion rapida.</p>
                  </article>
                </section>

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

                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Centro rapido de catalogo
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Edita datos, cambia visibilidad, destaca productos y reordena el catalogo
                        sin salir de este drawer. Todo se guarda en Supabase y refresca el
                        dashboard al instante.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Agregar producto
                    </button>
                  </div>
                </section>

                {!catalogStatus.canSell && firstInactiveProduct ? (
                  <section className="rounded-[22px] border border-amber-200 bg-amber-50/90 p-4">
                    <p className="text-sm font-semibold text-amber-900">
                      Falta un ultimo paso para vender
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-950">
                      Ya existe catalogo, pero el negocio sigue sin productos activos. Puedes
                      activar ahora mismo &quot;{firstInactiveProduct.name}&quot; y destrabar el link
                      publico sin salir de este drawer.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleActivateProduct(firstInactiveProduct)}
                      className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Activar &quot;{firstInactiveProduct.name}&quot;
                    </button>
                  </section>
                ) : null}

                {catalogStatus.canSell ? (
                  <section className="rounded-[22px] border border-sky-200 bg-sky-50/80 p-4">
                    <p className="text-sm font-semibold text-sky-900">
                      Link publico listo para operar
                    </p>
                    <p className="mt-1 break-all text-sm font-medium text-slate-900">
                      {publicUrl}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      El catalogo ya esta activo. Desde aqui puedes copiar el link o abrir
                      el formulario publico real.
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => void handleCopyPublicLink()}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        Copiar link publico
                      </button>
                      <Link
                        href={publicPath}
                        target="_blank"
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Abrir formulario
                      </Link>
                    </div>
                    {copyFeedback ? (
                      <p className="mt-3 text-sm text-slate-600">{copyFeedback}</p>
                    ) : null}
                  </section>
                ) : null}

                <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative lg:max-w-sm lg:flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Buscar por nombre o descripcion"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: "all", label: "Todos" },
                        { key: "active", label: "Activos" },
                        { key: "inactive", label: "Inactivos" },
                        { key: "featured", label: "Destacados" },
                      ] as Array<{ key: ProductListFilter; label: string }>).map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={() => setListFilter(filter.key)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            listFilter === filter.key
                              ? "bg-slate-950 text-white"
                              : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-500">
                    {visibleProducts.length} resultado{visibleProducts.length === 1 ? "" : "s"} para
                    operar rapido el catalogo.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {activeProducts.length} activo{activeProducts.length === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {inactiveProducts.length} inactivo{inactiveProducts.length === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      {featuredProducts.length} destacado{featuredProducts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </section>

                {visibleProducts.length === 0 ? (
                  <section className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center">
                    <h3 className="text-lg font-semibold text-slate-950">
                      No encontramos productos con ese criterio
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Ajusta la busqueda, cambia el filtro o vuelve a mostrar todo el catalogo
                      para seguir operando.
                    </p>
                    <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setListFilter("all");
                        }}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                      >
                        Limpiar filtros
                      </button>
                      <button
                        type="button"
                        onClick={openCreateForm}
                        className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Crear producto
                      </button>
                    </div>
                  </section>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {visibleProducts.map((product) => {
                      const productIndex = sortedProducts.findIndex((item) => item.id === product.id);
                      const storefrontPosition = storefrontPositions.get(product.id);

                      return (
                        <article
                          key={product.id}
                          className={`min-w-0 rounded-[24px] border p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] ${getProductOperationalTone(product)}`}
                        >
                          <div className="flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-lg font-semibold text-slate-950">
                                    {product.name}
                                  </h3>
                                  <ProductFlag
                                    label={product.is_available ? "Activo" : "Inactivo"}
                                    tone={product.is_available ? "success" : "neutral"}
                                  />
                                  {product.is_featured ? (
                                    <ProductFlag label="Destacado" tone="warning" />
                                  ) : null}
                                  <ProductFlag
                                    label={`Orden ${product.sort_order ?? productIndex + 1}`}
                                    tone="neutral"
                                  />
                                  <ProductFlag
                                    label={getProductStorefrontPositionLabel(product, storefrontPosition)}
                                    tone={product.is_available ? "success" : "neutral"}
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <p className="text-base font-semibold text-slate-950">
                                    {formatCurrency(product.price)}
                                  </p>
                                  <p className="text-sm font-medium text-slate-600">
                                    {getProductVisibilityCopy(product)}
                                  </p>
                                </div>
                                <p className="min-h-12 text-sm leading-6 text-slate-600">
                                  {product.description?.trim() ||
                                    "Sin descripcion. Puedes agregarla si ayuda a vender mejor el producto."}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => openEditForm(product)}
                                className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                              >
                                Editar
                              </button>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Estado
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-900">
                                  {product.is_available ? "Activo y visible" : "Inactivo y oculto"}
                                </p>
                              </div>
                              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Destacado
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-900">
                                  {product.is_featured ? "Si" : "No"}
                                </p>
                              </div>
                              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Precio
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-900">
                                  {formatCurrency(product.price)}
                                </p>
                              </div>
                              <div className="rounded-[18px] border border-slate-200 bg-white/80 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Link publico
                                </p>
                                <p className="mt-1 text-sm font-medium text-slate-900">
                                  {product.is_available
                                    ? `Posicion ${storefrontPosition ?? product.sort_order ?? productIndex + 1}`
                                    : "No visible"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-[20px] border border-slate-200 bg-white/90 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Acciones frecuentes
                            </p>
                            <div className="mt-3 flex flex-wrap items-start gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickToggle(product, "isAvailable", !product.is_available)
                                }
                                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                                  product.is_available
                                    ? "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                    : "bg-slate-950 text-white hover:bg-slate-800"
                                }`}
                              >
                                {product.is_available ? (
                                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Eye className="h-4 w-4" aria-hidden="true" />
                                )}
                                {product.is_available ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickToggle(product, "isFeatured", !product.is_featured)
                                }
                                disabled={!product.is_available && !product.is_featured}
                                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                                  !product.is_available && !product.is_featured
                                    ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                                    : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                {product.is_featured ? (
                                  <StarOff className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Star className="h-4 w-4" aria-hidden="true" />
                                )}
                                {product.is_featured ? "Quitar destacado" : "Destacar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditForm(product)}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                              >
                                Editar detalles
                              </button>
                            </div>

                            <div className="mt-3 flex flex-wrap items-start gap-2">
                              <button
                                type="button"
                                onClick={() => handleMove(product, "up")}
                                disabled={productIndex === 0}
                                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                                  productIndex === 0
                                    ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                                    : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                Mover arriba
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMove(product, "down")}
                                disabled={productIndex === sortedProducts.length - 1}
                                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                                  productIndex === sortedProducts.length - 1
                                    ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                                    : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                Mover abajo
                              </button>
                            </div>

                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              El borrado sigue disponible dentro de la edicion del producto para
                              mantener la operacion diaria enfocada en cambios seguros y rapidos.
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
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
                      {isFirstProductFlow
                        ? "Primer producto para destrabar ventas"
                        : "Alta rapida para activacion"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      {isFirstProductFlow
                        ? "Pide solo lo minimo. Si este producto queda activo, el negocio pasa directo a listo para compartir."
                        : "Para empezar a vender solo necesitas nombre, precio y dejar activo el producto. La descripcion, el orden y destacado pueden esperar."}
                    </p>
                    {isFirstProductFlow ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[18px] border border-sky-200 bg-white/90 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                            1
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">
                            Nombre claro
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            Lo que el cliente realmente va a pedir.
                          </p>
                        </div>
                        <div className="rounded-[18px] border border-sky-200 bg-white/90 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                            2
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">
                            Precio simple
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            Basta con un valor real para empezar a vender.
                          </p>
                        </div>
                        <div className="rounded-[18px] border border-sky-200 bg-white/90 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                            3
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">
                            Dejar activo
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            Asi el link publico queda listo al guardar.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : editingProduct ? (
                  <section className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950">
                        {editingProduct.name}
                      </h3>
                      <ProductFlag
                        label={editingProduct.is_available ? "Activo" : "Inactivo"}
                        tone={editingProduct.is_available ? "success" : "neutral"}
                      />
                      {editingProduct.is_featured ? (
                        <ProductFlag label="Destacado" tone="warning" />
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Ajusta nombre, precio, visibilidad y orden sin salir de la gestion del
                      catalogo.
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
                        placeholder={isFirstProductFlow ? "Ej. Combo desayuno" : "Ej. Caja de brownies"}
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
                      <p className="text-sm font-medium text-slate-900">Lectura rapida</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formState.isAvailable
                          ? "Activo. Se mostrara en el formulario publico."
                          : "Inactivo. No se mostrara en el link publico."}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formState.isAvailable
                          ? `Si guardas ahora, quedara en la posicion ${nextSortOrder} del catalogo visible.`
                          : `Si guardas ahora, quedara fuera del storefront hasta activarlo.`}
                      </p>
                      {mode === "create" ? (
                        <p className="mt-1 text-sm text-slate-600">
                          {formState.isAvailable
                            ? isFirstProductFlow
                              ? "Si guardas asi, el negocio queda listo para abrir el link publico."
                              : "Si guardas asi, el negocio queda mas cerca de compartir el link."
                            : "Si guardas asi, todavia faltara activarlo para vender."}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-slate-600">
                          {formState.isFeatured
                            ? "Destacado para seleccion rapida."
                            : "Sin destacado por ahora."}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Detalle del producto</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Completa esto solo si suma claridad comercial al catalogo.
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

                      {mode === "edit" ? (
                        <>
                          <label className="space-y-2">
                            <span className="text-sm font-medium text-slate-700">Orden</span>
                            <input
                              type="number"
                              min="1"
                              value={formState.sortOrder}
                              onChange={(event) => updateFormField("sortOrder", event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                            />
                            <p className="text-xs leading-5 text-slate-500">
                              El storefront publica los productos activos siguiendo este orden.
                            </p>
                          </label>

                          <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">Destacado</p>
                              <p className="text-sm text-slate-600">
                                Resalta este producto en la seleccion rapida del storefront.
                                {!formState.isAvailable
                                  ? " Mientras siga inactivo, ese destacado no se mostrara."
                                  : ""}
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={formState.isFeatured}
                              onChange={(event) => updateFormField("isFeatured", event.target.checked)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                            />
                          </label>
                        </>
                      ) : null}
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

                    {mode === "create" && !isFirstProductFlow ? (
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

                {mode === "edit" && editingProduct ? (
                  <section className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-5">
                    <p className="text-sm font-semibold text-rose-700">Borrado seguro</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      Puedes borrar este producto si no aparece en pedidos ya persistidos.
                      Si ya fue usado, el sistema bloqueara el borrado y te sugerira
                      desactivarlo para conservar el historial.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDeleteCandidate(editingProduct)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Borrar producto
                    </button>
                  </section>
                ) : null}
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white/96 px-4 py-4 backdrop-blur sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode("list");
                    setEditingProductId(null);
                    setDeleteCandidate(null);
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
                      ? !isFirstProductFlow && createAnotherAfterSave
                        ? "Guardar y crear otro"
                        : isFirstProductFlow
                          ? "Crear producto y habilitar link"
                          : "Crear producto"
                      : "Guardar cambios"}
                </button>
              </div>
            </div>
          </form>
        )}
      </aside>

      <DeleteProductDialog
        product={deleteCandidate}
        isDeleting={isDeleting}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteCandidate(null);
          }
        }}
        onConfirm={() => void handleDeleteProduct()}
      />
    </>
  );
}
