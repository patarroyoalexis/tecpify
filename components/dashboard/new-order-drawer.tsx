"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getAvailablePaymentMethods,
  getPaymentMethodLabel,
} from "@/components/dashboard/payment-helpers";
import { OrdersUiIcon } from "@/components/dashboard/orders-ui-icon";
import { fetchProductsByBusinessId } from "@/lib/products/api";
import type { Product } from "@/types/products";
import type {
  DeliveryType,
  Order,
  OrderProduct,
  PaymentMethod,
} from "@/types/orders";

interface NewOrderDrawerProps {
  businessDatabaseId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (input: NewOrderFormValue) => Promise<Order>;
  onOpenProducts?: () => void;
}

interface ProductField {
  id: string;
  productId: string;
  quantity: string;
}

export interface NewOrderFormValue {
  client: string;
  customerWhatsApp: string;
  products: OrderProduct[];
  total: number;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  observations?: string;
}

const deliveryTypes: DeliveryType[] = ["domicilio", "recogida en tienda"];

function createEmptyProduct(): ProductField {
  return {
    id: Math.random().toString(16).slice(2, 8),
    productId: "",
    quantity: "1",
  };
}

export function NewOrderDrawer({
  businessDatabaseId,
  isOpen,
  onClose,
  onCreateOrder,
  onOpenProducts,
}: NewOrderDrawerProps) {
  const [client, setClient] = useState("");
  const [customerWhatsApp, setCustomerWhatsApp] = useState("");
  const [products, setProducts] = useState<ProductField[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [total, setTotal] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType | "">("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [observations, setObservations] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availablePaymentMethods = useMemo(
    () => getAvailablePaymentMethods(deliveryType),
    [deliveryType],
  );

  const activeProducts = useMemo(
    () => catalogProducts.filter((product) => product.is_available),
    [catalogProducts],
  );

  const selectedProductIds = useMemo(
    () => products.map((product) => product.productId).filter(Boolean),
    [products],
  );

  const hasActiveProducts = activeProducts.length > 0;
  const canAddAnotherProduct =
    hasActiveProducts && selectedProductIds.length < activeProducts.length;

  useEffect(() => {
    if (!isOpen || !businessDatabaseId) {
      return;
    }

    let isCancelled = false;

    async function loadProducts() {
      setIsLoadingProducts(true);
      setProductsError("");

      try {
        const fetchedProducts = await fetchProductsByBusinessId(businessDatabaseId);

        if (isCancelled) {
          return;
        }

        setCatalogProducts(fetchedProducts);
        setProducts((currentProducts) => {
          if (fetchedProducts.length === 0) {
            return [];
          }

          if (currentProducts.length > 0) {
            const nextProducts = currentProducts.filter((product) =>
              fetchedProducts.some((catalogProduct) => catalogProduct.id === product.productId),
            );

            return nextProducts.length > 0 ? nextProducts : [createEmptyProduct()];
          }

          return [createEmptyProduct()];
        });
      } catch (loadError) {
        if (isCancelled) {
          return;
        }

        setCatalogProducts([]);
        setProducts([]);
        setProductsError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar el catálogo activo.",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isCancelled = true;
    };
  }, [businessDatabaseId, isOpen]);

  function resetForm() {
    setClient("");
    setCustomerWhatsApp("");
    setProducts(activeProducts.length > 0 ? [createEmptyProduct()] : []);
    setTotal("");
    setPaymentMethod("");
    setDeliveryType("");
    setDeliveryAddress("");
    setObservations("");
    setError("");
    setProductsError("");
    setIsSubmitting(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleProductChange(
    productFieldId: string,
    field: "productId" | "quantity",
    value: string,
  ) {
    setError("");
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productFieldId ? { ...product, [field]: value } : product,
      ),
    );
  }

  function handleAddProduct() {
    if (!canAddAnotherProduct) {
      return;
    }

    setError("");
    setProducts((currentProducts) => [...currentProducts, createEmptyProduct()]);
  }

  function handleRemoveProduct(productFieldId: string) {
    setError("");
    setProducts((currentProducts) =>
      currentProducts.length === 1
        ? currentProducts
        : currentProducts.filter((product) => product.id !== productFieldId),
    );
  }

  function handleDeliveryTypeChange(value: DeliveryType | "") {
    setDeliveryType(value);
    setError("");

    if (value !== "domicilio") {
      setDeliveryAddress("");
    }

    if (paymentMethod && !getAvailablePaymentMethods(value).includes(paymentMethod)) {
      setPaymentMethod("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessDatabaseId) {
      setError("No fue posible identificar el negocio actual.");
      return;
    }

    if (!hasActiveProducts) {
      setError("Activa al menos un producto del catálogo para crear pedidos manuales.");
      return;
    }

    const normalizedProducts = products.map((product) => {
      const selectedProduct = activeProducts.find(
        (catalogProduct) => catalogProduct.id === product.productId,
      );

      return {
        fieldId: product.id,
        selectedProduct,
        quantity: Number(product.quantity),
      };
    });

    if (!client.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }

    if (!customerWhatsApp.trim()) {
      setError("El WhatsApp del cliente es obligatorio.");
      return;
    }

    if (normalizedProducts.length === 0) {
      setError("Agrega al menos un producto válido.");
      return;
    }

    if (normalizedProducts.some((product) => !product.selectedProduct)) {
      setError("Selecciona un producto del catálogo en cada fila.");
      return;
    }

    if (
      normalizedProducts.some(
        (product) => !Number.isFinite(product.quantity) || product.quantity < 1,
      )
    ) {
      setError("Cada producto debe tener una cantidad mayor o igual a 1.");
      return;
    }

    const uniqueProductIds = new Set(
      normalizedProducts.map((product) => product.selectedProduct?.id ?? ""),
    );

    if (uniqueProductIds.size !== normalizedProducts.length) {
      setError("No puedes repetir el mismo producto en varias filas del pedido.");
      return;
    }

    if (Number(total) <= 0) {
      setError("El total debe ser mayor que 0.");
      return;
    }

    if (!paymentMethod) {
      setError("Selecciona un método de pago.");
      return;
    }

    if (!deliveryType) {
      setError("Selecciona un tipo de entrega.");
      return;
    }

    if (deliveryType === "domicilio" && !deliveryAddress.trim()) {
      setError("La dirección es obligatoria para pedidos a domicilio.");
      return;
    }

    if (!getAvailablePaymentMethods(deliveryType).includes(paymentMethod)) {
      setError("Selecciona un método de pago válido para este tipo de entrega.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onCreateOrder({
        client: client.trim(),
        customerWhatsApp: customerWhatsApp.trim(),
        products: normalizedProducts.map(({ selectedProduct, quantity }) => ({
          productId: selectedProduct!.id,
          name: selectedProduct!.name,
          quantity,
          unitPrice: selectedProduct!.price,
        })),
        total: Number(total),
        paymentMethod,
        deliveryType,
        deliveryAddress:
          deliveryType === "domicilio" ? deliveryAddress.trim() : undefined,
        observations: observations.trim() || undefined,
      });

      handleClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible crear el pedido.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/30 transition ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={handleClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.15)] transition-transform duration-200 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500">Tecpify</p>
            <h2 className="text-2xl font-semibold text-slate-950">Nuevo pedido</h2>
            <p className="text-sm text-slate-600">
              Registra manualmente un pedido y súmalo al flujo operativo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <OrdersUiIcon icon="x" className="h-4 w-4" />
            Cerrar
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-6 py-6"
        >
          <div className="space-y-6">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Cliente</span>
                  <input
                    value={client}
                    onChange={(event) => {
                      setClient(event.target.value);
                      setError("");
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                    placeholder="Nombre del cliente o negocio"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    WhatsApp del cliente
                  </span>
                  <input
                    value={customerWhatsApp}
                    onChange={(event) => {
                      setCustomerWhatsApp(event.target.value);
                      setError("");
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                    placeholder="3001234567"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Total</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={total}
                    onChange={(event) => {
                      setTotal(event.target.value);
                      setError("");
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                    placeholder="0"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Método de pago
                  </span>
                  <select
                    value={paymentMethod}
                    onChange={(event) => {
                      setPaymentMethod(event.target.value as PaymentMethod | "");
                      setError("");
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                  >
                    <option value="">Seleccionar</option>
                    {availablePaymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {getPaymentMethodLabel(method, deliveryType || undefined)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Contra entrega solo está disponible para pedidos a domicilio.
                  </p>
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Tipo de entrega
                  </span>
                  <select
                    value={deliveryType}
                    onChange={(event) =>
                      handleDeliveryTypeChange(
                        event.target.value as DeliveryType | "",
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                  >
                    <option value="">Seleccionar</option>
                    {deliveryTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                {deliveryType === "domicilio" ? (
                  <label className="space-y-2 sm:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      Dirección de entrega
                    </span>
                    <textarea
                      rows={3}
                      value={deliveryAddress}
                      onChange={(event) => {
                        setDeliveryAddress(event.target.value);
                        setError("");
                      }}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                      placeholder="Calle, barrio, referencias o apartamento"
                    />
                  </label>
                ) : null}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Productos</h3>
                  <p className="text-sm text-slate-600">
                    Selecciona productos activos del catálogo y define su cantidad.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!canAddAnotherProduct || isLoadingProducts}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                    !canAddAnotherProduct || isLoadingProducts
                      ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                      : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <OrdersUiIcon icon="plus" className="h-4 w-4" />
                  Agregar producto
                </button>
              </div>

              {isLoadingProducts ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Cargando catálogo activo...
                </div>
              ) : productsError ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {productsError}
                </div>
              ) : !businessDatabaseId ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  No fue posible identificar el negocio actual para cargar su catálogo.
                </div>
              ) : !hasActiveProducts ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-medium text-slate-900">
                    Este negocio todavía no tiene productos activos.
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Activa o crea al menos un producto para registrar pedidos manuales con catálogo estandarizado.
                  </p>
                  {onOpenProducts ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        onOpenProducts();
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      <OrdersUiIcon icon="package" className="h-4 w-4" />
                      Administrar catálogo
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-4">
                    {products.map((product, index) => {
                      const availableOptions = activeProducts.filter(
                        (catalogProduct) =>
                          catalogProduct.id === product.productId ||
                          !selectedProductIds.includes(catalogProduct.id),
                      );
                      const selectedProduct = activeProducts.find(
                        (catalogProduct) => catalogProduct.id === product.productId,
                      );

                      return (
                        <div
                          key={product.id}
                          className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_120px_auto]"
                        >
                          <label className="space-y-2">
                            <span className="text-sm font-medium text-slate-700">
                              Producto {index + 1}
                            </span>
                            <select
                              value={product.productId}
                              onChange={(event) =>
                                handleProductChange(
                                  product.id,
                                  "productId",
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                            >
                              <option value="">Selecciona un producto</option>
                              {availableOptions.map((catalogProduct) => (
                                <option key={catalogProduct.id} value={catalogProduct.id}>
                                  {catalogProduct.name}
                                </option>
                              ))}
                            </select>
                            {selectedProduct ? (
                              <p className="text-xs text-slate-500">
                                {selectedProduct.price.toLocaleString("es-CO", {
                                  style: "currency",
                                  currency: "COP",
                                  maximumFractionDigits: 0,
                                })}
                              </p>
                            ) : null}
                          </label>

                          <label className="space-y-2">
                            <span className="text-sm font-medium text-slate-700">
                              Cantidad
                            </span>
                            <input
                              type="number"
                              min="1"
                              value={product.quantity}
                              onChange={(event) =>
                                handleProductChange(
                                  product.id,
                                  "quantity",
                                  event.target.value,
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                            />
                          </label>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(product.id)}
                              disabled={products.length === 1}
                              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-sm font-medium transition ${
                                products.length === 1
                                  ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                                  : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              }`}
                            >
                              <OrdersUiIcon icon="minus" className="h-4 w-4" />
                              Quitar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!canAddAnotherProduct ? (
                    <p className="mt-4 text-xs text-slate-500">
                      Ya usaste todos los productos activos disponibles para este pedido.
                    </p>
                  ) : null}
                </>
              )}
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Observaciones
                </span>
                <textarea
                  value={observations}
                  onChange={(event) => {
                    setObservations(event.target.value);
                    setError("");
                  }}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                  placeholder="Notas internas, instrucciones o contexto adicional"
                />
              </label>
            </section>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <OrdersUiIcon icon="x" className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoadingProducts || !hasActiveProducts}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <OrdersUiIcon icon="clipboard-check" className="h-4 w-4" />
                {isSubmitting ? "Creando pedido..." : "Crear pedido"}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </>
  );
}
