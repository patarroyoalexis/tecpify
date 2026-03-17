"use client";

import { useMemo, useState } from "react";

import {
  getAvailablePaymentMethods,
  getPaymentMethodLabel,
} from "@/components/dashboard/payment-helpers";
import type {
  DeliveryType,
  OrderProduct,
  PaymentMethod,
} from "@/types/orders";

interface NewOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (input: NewOrderFormValue) => void;
}

interface ProductField {
  id: string;
  name: string;
  quantity: string;
}

export interface NewOrderFormValue {
  client: string;
  products: OrderProduct[];
  total: number;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  observations?: string;
}

const deliveryTypes: DeliveryType[] = ["domicilio", "recogida en tienda"];

function createEmptyProduct(): ProductField {
  return {
    id: Math.random().toString(16).slice(2, 8),
    name: "",
    quantity: "1",
  };
}

export function NewOrderDrawer({
  isOpen,
  onClose,
  onCreateOrder,
}: NewOrderDrawerProps) {
  const [client, setClient] = useState("");
  const [products, setProducts] = useState<ProductField[]>([createEmptyProduct()]);
  const [total, setTotal] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType | "">("");
  const [observations, setObservations] = useState("");
  const [error, setError] = useState("");

  const availablePaymentMethods = useMemo(
    () => getAvailablePaymentMethods(deliveryType),
    [deliveryType],
  );

  function resetForm() {
    setClient("");
    setProducts([createEmptyProduct()]);
    setTotal("");
    setPaymentMethod("");
    setDeliveryType("");
    setObservations("");
    setError("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleProductChange(
    productId: string,
    field: "name" | "quantity",
    value: string,
  ) {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, [field]: value } : product,
      ),
    );
  }

  function handleAddProduct() {
    setProducts((currentProducts) => [...currentProducts, createEmptyProduct()]);
  }

  function handleRemoveProduct(productId: string) {
    setProducts((currentProducts) =>
      currentProducts.length === 1
        ? currentProducts
        : currentProducts.filter((product) => product.id !== productId),
    );
  }

  function handleDeliveryTypeChange(value: DeliveryType | "") {
    setDeliveryType(value);
    setError("");

    if (paymentMethod && !getAvailablePaymentMethods(value).includes(paymentMethod)) {
      setPaymentMethod("");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedProducts = products
      .map((product) => ({
        name: product.name.trim(),
        quantity: Number(product.quantity),
      }))
      .filter((product) => product.name.length > 0 && product.quantity > 0);

    if (!client.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }

    if (normalizedProducts.length === 0) {
      setError("Agrega al menos un producto valido.");
      return;
    }

    if (Number(total) <= 0) {
      setError("El total debe ser mayor que 0.");
      return;
    }

    if (!paymentMethod) {
      setError("Selecciona un metodo de pago.");
      return;
    }

    if (!deliveryType) {
      setError("Selecciona un tipo de entrega.");
      return;
    }

    if (!getAvailablePaymentMethods(deliveryType).includes(paymentMethod)) {
      setError("Selecciona un metodo de pago valido para este tipo de entrega.");
      return;
    }

    onCreateOrder({
      client: client.trim(),
      products: normalizedProducts,
      total: Number(total),
      paymentMethod,
      deliveryType,
      observations: observations.trim() || undefined,
    });

    handleClose();
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
            <h2 className="text-2xl font-semibold text-slate-950">
              Nuevo pedido
            </h2>
            <p className="text-sm text-slate-600">
              Registra manualmente un pedido y sumalo al flujo operativo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
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
                    onChange={(event) => setClient(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                    placeholder="Nombre del cliente o negocio"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Total</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={total}
                    onChange={(event) => setTotal(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                    placeholder="0"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Metodo de pago
                  </span>
                  <select
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(event.target.value as PaymentMethod | "")
                    }
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
                    Contra entrega solo esta disponible para pedidos a domicilio.
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
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Productos</h3>
                  <p className="text-sm text-slate-600">
                    Agrega uno o mas productos con su cantidad.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Agregar producto
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_120px_auto]"
                  >
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">
                        Producto {index + 1}
                      </span>
                      <input
                        value={product.name}
                        onChange={(event) =>
                          handleProductChange(product.id, "name", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-400 sm:text-sm sm:leading-5"
                        placeholder="Nombre del producto"
                      />
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
                        className={`rounded-full px-4 py-3 text-sm font-medium transition ${
                          products.length === 1
                            ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                            : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        }`}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  Observaciones
                </span>
                <textarea
                  value={observations}
                  onChange={(event) => setObservations(event.target.value)}
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
                className="rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Crear pedido
              </button>
            </div>
          </div>
        </form>
      </aside>
    </>
  );
}
