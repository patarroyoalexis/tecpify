"use client";

import { useEffect, useId, useRef, useState } from "react";

interface NewActionsMenuProps {
  onNewOrder: () => void;
  onNewProduct: () => void;
  variant?: "responsive" | "desktop" | "mobile";
}

interface ActionItem {
  key: "order" | "product";
  label: string;
  description: string;
  onSelect: () => void;
}

function PlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function PackageIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M12 12 4 7.5" />
      <path d="M12 12l8-4.5" />
      <path d="M12 21v-9" />
    </svg>
  );
}

function ClipboardIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4.5h6" />
      <path d="M9 10h6" />
      <path d="M9 14h4" />
    </svg>
  );
}

function ActionButton({
  item,
  onSelect,
}: {
  item: ActionItem;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-2xl border border-transparent px-3.5 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {item.key === "order" ? <ClipboardIcon /> : <PackageIcon />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-950">
          {item.label}
        </span>
        <span className="mt-0.5 block text-sm leading-5 text-slate-500">
          {item.description}
        </span>
      </span>
    </button>
  );
}

export function NewActionsMenu({
  onNewOrder,
  onNewProduct,
  variant = "responsive",
}: NewActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const desktopContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileContainerRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const actions: ActionItem[] = [
    {
      key: "order",
      label: "Nuevo pedido",
      description: "Registra manualmente un pedido y sumalo al flujo operativo.",
      onSelect: onNewOrder,
    },
    {
      key: "product",
      label: "Nuevo producto",
      description: "Crea un producto nuevo para el catalogo del negocio.",
      onSelect: onNewProduct,
    },
  ];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;

      const clickedOutsideDesktop =
        !desktopContainerRef.current ||
        (target instanceof Node && !desktopContainerRef.current.contains(target));
      const clickedOutsideMobile =
        !mobileContainerRef.current ||
        (target instanceof Node && !mobileContainerRef.current.contains(target));

      if (clickedOutsideDesktop && clickedOutsideMobile) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(action: ActionItem) {
    setIsOpen(false);
    action.onSelect();
  }

  return (
    <>
      {variant !== "mobile" ? (
        <div
          ref={desktopContainerRef}
          className={`relative ${variant === "desktop" ? "flex" : "hidden md:flex"}`}
        >
          <button
            type="button"
            onClick={() => setIsOpen((currentValue) => !currentValue)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={menuId}
          >
            <PlusIcon />
            <span>Nuevo</span>
          </button>

          {isOpen ? (
            <div
              id={menuId}
              role="menu"
              aria-label="Acciones nuevas"
              className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[22rem] rounded-[26px] border border-slate-200/80 bg-white/96 p-2 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur"
            >
              <div className="border-b border-slate-200 px-3.5 pb-3 pt-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Crear
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Elige que quieres agregar al flujo del negocio.
                </p>
              </div>

              <div className="mt-2 space-y-1">
                {actions.map((action) => (
                  <ActionButton
                    key={action.key}
                    item={action}
                    onSelect={() => handleSelect(action)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {variant !== "desktop" ? (
        <div
          ref={mobileContainerRef}
          className={variant === "mobile" ? "block" : "md:hidden"}
        >
          {isOpen ? <div className="fixed inset-0 z-40" aria-hidden="true" /> : null}

          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-[max(1rem,env(safe-area-inset-right))] z-50 flex flex-col items-end gap-3">
            {isOpen ? (
              <div
                id={`${menuId}-mobile`}
                role="menu"
                aria-label="Acciones nuevas"
                className="w-[min(22rem,calc(100vw-2rem))] rounded-[26px] border border-slate-200/80 bg-white/96 p-2 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur"
              >
                <div className="border-b border-slate-200 px-3.5 pb-3 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Crear
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Abre el drawer que necesitas para continuar.
                  </p>
                </div>

                <div className="mt-2 space-y-1">
                  {actions.map((action) => (
                    <ActionButton
                      key={`mobile-${action.key}`}
                      item={action}
                      onSelect={() => handleSelect(action)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setIsOpen((currentValue) => !currentValue)}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
              aria-label={isOpen ? "Cerrar acciones nuevas" : "Abrir acciones nuevas"}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={`${menuId}-mobile`}
            >
              <PlusIcon className={`h-5 w-5 transition ${isOpen ? "rotate-45" : ""}`} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
