"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { formatCurrency } from "@/data/orders";
import {
  getOrdersByBusinessFromSupabase,
  matchesGlobalOrderSearch,
  mergeOrdersForGlobalSearch,
} from "@/lib/data/orders-search";
import type { Order } from "@/types/orders";

interface GlobalOrderSearchProps {
  businessDatabaseId: string | null;
  localOrders: Order[];
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (order: Order) => void;
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightMatch({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return <>{text}</>;
  }

  const matcher = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "ig");
  const parts = text.split(matcher);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === normalizedQuery.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded bg-amber-100 px-0.5 text-inherit"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delayMs, value]);

  return debouncedValue;
}

export function GlobalOrderSearch({
  businessDatabaseId,
  localOrders,
  isOpen,
  onClose,
  onSelectOrder,
}: GlobalOrderSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [remoteOrders, setRemoteOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    queueMicrotask(() => {
      inputRef.current?.focus();
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || hasLoaded || !businessDatabaseId) {
      return;
    }

    let isCancelled = false;

    async function loadOrders() {
  setIsLoading(true);
  setError("");

  try {
    if (!businessDatabaseId) {
      if (!isCancelled) {
        setRemoteOrders([]);
        setHasLoaded(true);
      }
      return;
    }

    const orders = await getOrdersByBusinessFromSupabase(businessDatabaseId);

    if (!isCancelled) {
      setRemoteOrders(orders);
      setHasLoaded(true);
    }
  } catch (loadError) {
    if (!isCancelled) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible consultar los pedidos en este momento.",
      );
      setHasLoaded(true);
    }
  } finally {
    if (!isCancelled) {
      setIsLoading(false);
    }
  }
}

    void loadOrders();

    return () => {
      isCancelled = true;
    };
  }, [businessDatabaseId, hasLoaded, isOpen]);

  const mergedOrders = useMemo(
    () => mergeOrdersForGlobalSearch(localOrders, remoteOrders),
    [localOrders, remoteOrders],
  );

  const visibleResults = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return [];
    }

    return mergedOrders.filter((order) =>
      matchesGlobalOrderSearch(order, debouncedQuery),
    );
  }, [debouncedQuery, mergedOrders]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/35"
        onClick={onClose}
      />
      <section className="fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
        <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <SearchIcon />
              </div>
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor="global-orders-search">
                  Buscar pedidos globalmente
                </label>
                <input
                  id="global-orders-search"
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por cliente, telefono, pedido, direccion o producto"
                  className="w-full border-none bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-5">
            {!query.trim() ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                Escribe para buscar en todos los pedidos del negocio actual.
              </div>
            ) : isLoading ? (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                Buscando pedidos...
              </div>
            ) : error ? (
              <div className="rounded-[22px] border border-rose-200 bg-rose-50/80 px-4 py-8 text-center text-sm text-rose-700">
                {error}
              </div>
            ) : visibleResults.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                No encontramos coincidencias para esta busqueda.
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibleResults.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      onSelectOrder(order);
                      onClose();
                    }}
                    className="w-full rounded-[22px] border border-slate-200/80 bg-white px-4 py-3.5 text-left shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-[15px] font-semibold text-slate-950 sm:text-base">
                          <HighlightMatch text={order.client} query={debouncedQuery} />
                        </p>
                        <p className="shrink-0 text-[15px] font-semibold text-slate-950 sm:text-base">
                          {formatCurrency(order.total)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600">
                          <HighlightMatch text={order.id} query={debouncedQuery} />
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {order.status}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {order.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
