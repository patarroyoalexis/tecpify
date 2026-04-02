"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Store, 
  Tag, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  Loader2,
  Package,
  DollarSign
} from "lucide-react";
import { createSlugFromBusinessName } from "@/lib/businesses/slug";

const BUSINESS_TYPES = [
  "Restaurante / Comida",
  "Ropa / Moda",
  "Tienda / Retail",
  "Servicios / Consultoría",
  "Arte / Manualidades",
  "Otros"
];

interface ProductInput {
  id: string;
  name: string;
  price: string;
}

type OnboardingTarget = "businessName" | "businessType" | "productName" | "publish";
type OnboardingStepStatus = "completed" | "current" | "pending" | "ready";

interface OnboardingStep {
  key: string;
  label: string;
  helper: string;
  ctaLabel: string;
  target: OnboardingTarget;
  isDone: boolean;
  status?: OnboardingStepStatus;
}

export function OnboardingFlow() {
  const router = useRouter();
  const businessNameInputRef = useRef<HTMLInputElement | null>(null);
  const businessTypeSelectRef = useRef<HTMLSelectElement | null>(null);
  const productNameInputRef = useRef<HTMLInputElement | null>(null);
  const [isMobileKeyboardOpen, setIsMobileKeyboardOpen] = useState(false);
  
  // Estado del formulario
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [products, setProducts] = useState<ProductInput[]>([
    { id: crypto.randomUUID(), name: "", price: "" }
  ]);
  
  // Estado de UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validaciones para el checklist
  const isBusinessNameValid = businessName.trim().length >= 3;
  const isBusinessTypeValid = businessType !== "";
  const hasAtLeastOneProduct = products.some(p => p.name.trim() !== "" && p.price.trim() !== "" && !isNaN(Number(p.price)));
  const canPublish = isBusinessNameValid && isBusinessTypeValid && hasAtLeastOneProduct;
  const onboardingSteps: OnboardingStep[] = [
    {
      key: "businessName",
      label: "Nombre del negocio",
      helper: "Define como quieres presentarte para empezar con una base clara.",
      ctaLabel: "Agregar nombre del negocio",
      target: "businessName",
      isDone: isBusinessNameValid,
    },
    {
      key: "businessType",
      label: "Tipo de negocio",
      helper: "Selecciona la categoria para dar contexto a tu espacio.",
      ctaLabel: "Seleccionar tipo",
      target: "businessType",
      isDone: isBusinessTypeValid,
    },
    {
      key: "productName",
      label: "Agregar producto",
      helper: "Tu primer producto hace que el onboarding se sienta real y util.",
      ctaLabel: "Agregar tu primer producto",
      target: "productName",
      isDone: hasAtLeastOneProduct,
    },
    {
      key: "publish",
      label: "Publicar",
      helper: "Ya tienes lo esencial. Solo falta dar el paso final.",
      ctaLabel: "Publicar negocio",
      target: "publish",
      isDone: canPublish,
    },
  ];
  const firstPendingStepIndex = onboardingSteps.findIndex((step) => !step.isDone);
  const currentStepIndex =
    firstPendingStepIndex === -1 ? onboardingSteps.length - 1 : firstPendingStepIndex;
  const stepsWithStatus = onboardingSteps.map((step, index) => {
    let status: OnboardingStepStatus;

    if (step.key === "publish" && canPublish) {
      status = "ready";
    } else if (step.isDone) {
      status = "completed";
    } else if (index === currentStepIndex) {
      status = "current";
    } else {
      status = "pending";
    }

    return {
      ...step,
      status,
    };
  });
  const currentStep = stepsWithStatus[currentStepIndex] ?? stepsWithStatus[0];
  const completedStepsCount = stepsWithStatus.filter(
    (step) => step.status === "completed" || step.status === "ready",
  ).length;
  const progressHeadline = canPublish
    ? "Todo listo para publicar"
    : completedStepsCount === 3
      ? "Solo te falta un paso"
      : completedStepsCount >= 2
        ? "Ya tienes lo esencial"
        : completedStepsCount === 1
          ? "Tu negocio va tomando forma"
          : "Empecemos con lo esencial";
  const progressDetail = canPublish
    ? "Tu negocio ya tiene lo necesario para salir con confianza."
    : currentStep.helper;
  const mobilePrimaryAction = {
    label: canPublish ? "Publicar negocio" : currentStep.ctaLabel,
    target: canPublish ? ("publish" as const) : currentStep.target,
  };
  const mobileFooterMode = isMobileKeyboardOpen ? "compact" : "full";
  const mobileContentPaddingBottom = isMobileKeyboardOpen
    ? "pb-[calc(8.25rem+env(safe-area-inset-bottom))]"
    : "pb-[calc(13rem+env(safe-area-inset-bottom))]";
  const mobileFooterShellClassName =
    mobileFooterMode === "compact"
      ? "py-2.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))]"
      : "py-[0.68rem] pb-[calc(0.78rem+env(safe-area-inset-bottom))]";
  const mobileFooterCardClassName =
    mobileFooterMode === "compact"
      ? "px-4 py-2.5 shadow-[0_-8px_22px_rgba(15,23,42,0.07)]"
      : "px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)]";
  const mobileFooterHeaderClassName =
    mobileFooterMode === "compact" ? "mb-1.5" : "mb-2.5";
  const mobileFooterProgressClassName =
    mobileFooterMode === "compact" ? "mb-[5px]" : "mb-2.5";
  const mobileFooterDescriptionClassName =
    mobileFooterMode === "compact" ? "mb-0 truncate opacity-[0.85]" : "mb-3 opacity-100";
  const mobileFooterActionWrapperClassName =
    mobileFooterMode === "compact" ? "max-h-0 overflow-hidden opacity-0" : "max-h-16 opacity-100";

  useEffect(() => {
    const isEditableElement = (element: Element | null) =>
      Boolean(
        element &&
          (element.matches("input, select, textarea, [contenteditable='true']") ||
            element.closest("input, select, textarea, [contenteditable='true']")),
      );

    const updateKeyboardState = () => {
      if (typeof window === "undefined") {
        return;
      }

      const viewport = window.visualViewport;
      const activeElement = document.activeElement;
      const isKeyboardLikelyOpen =
        Boolean(viewport) &&
        window.innerWidth < 1024 &&
        isEditableElement(activeElement) &&
        viewport!.height < window.innerHeight - 120;

      setIsMobileKeyboardOpen(isKeyboardLikelyOpen);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isEditableElement(event.target as Element | null)) {
        return;
      }

      setIsMobileKeyboardOpen(window.innerWidth < 1024);
      window.setTimeout(updateKeyboardState, 80);
    };

    const onFocusOut = () => {
      window.setTimeout(updateKeyboardState, 120);
    };

    const onViewportChange = () => {
      window.setTimeout(updateKeyboardState, 50);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);

    updateKeyboardState();

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
    };
  }, []);

  const addProduct = () => {
    setProducts([...products, { id: crypto.randomUUID(), name: "", price: "" }]);
  };

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    } else {
      setProducts([{ id: crypto.randomUUID(), name: "", price: "" }]);
    }
  };

  const updateProduct = (id: string, field: keyof ProductInput, value: string) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const focusMobileTarget = (target: "businessName" | "businessType" | "productName" | "publish") => {
    if (target === "publish") {
      void handlePublish();
      return;
    }

    const element =
      target === "businessName"
        ? businessNameInputRef.current
        : target === "businessType"
          ? businessTypeSelectRef.current
          : productNameInputRef.current;

    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus();
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Generar slug (esto se validará server-side también con reintento)
      const businessSlug = createSlugFromBusinessName(businessName);
      
      // 2. Crear negocio
      const businessResponse = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: businessName,
          businessSlug,
          businessType
        })
      });

      const businessData = await businessResponse.json();

      if (!businessResponse.ok) {
        throw new Error(businessData.error || "No fue posible crear el negocio.");
      }

      const createdBusinessSlug = businessData.business.businessSlug;

      // 3. Crear productos (solo los válidos)
      const validProducts = products.filter(p => p.name.trim() !== "" && p.price.trim() !== "");
      
      for (const product of validProducts) {
        const productResponse = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessSlug: createdBusinessSlug,
            name: product.name,
            price: Number(product.price),
            isAvailable: true
          })
        });

        if (!productResponse.ok) {
          const productData = await productResponse.json();
          console.error("Error creando producto:", productData.error);
          // Continuamos con el resto si uno falla? Por ahora sí, o podríamos fallar todo.
          // El usuario pidió "crear negocio y primer producto en una sola experiencia".
        }
      }

      // 4. Redirigir al dashboard del negocio creado
      router.push(`/dashboard/${createdBusinessSlug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:h-full lg:min-h-0 lg:px-0 lg:pt-0 ${mobileContentPaddingBottom}`}>
      {/* Layout Responsivo: 1 col en movil, 3 cols en desktop */}
      <div className="grid gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[0.95fr_minmax(0,1.38fr)_0.9fr] xl:gap-8">
        
        {/* Columna Izquierda: Mensaje amigable */}
        <div className="lg:flex lg:h-full lg:items-center">
          <div className="space-y-4 lg:max-w-md">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[2.1rem] sm:leading-tight">
              Crea tu espacio de pedidos
            </h1>
            <p className="max-w-md text-base leading-7 text-slate-600 sm:text-[1.05rem]">
              Empieza con lo básico y publica tu negocio en pocos minutos. Tecpify te ayuda a organizar tus productos y recibir pedidos de forma sencilla.
            </p>
            <div className="hidden lg:block pt-0 opacity-15">
               <Store className="h-20 w-20 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Columna Central: Formulario */}
        <div className="space-y-6 lg:min-h-0 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-2">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {/* Grupo 1: Negocio */}
          <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Store className="h-[18px] w-[18px]" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Tu negocio</h2>
            </div>
            
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <label htmlFor="businessName" className="text-sm font-semibold text-slate-700">
                  Nombre del negocio
                </label>
                <input
                  id="businessName"
                  ref={businessNameInputRef}
                  type="text"
                  placeholder="Ej: Pastelería Doña Rosa"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="businessType" className="text-sm font-semibold text-slate-700">
                  Tipo de negocio
                </label>
                <select
                  id="businessType"
                  ref={businessTypeSelectRef}
                  className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="" disabled>Selecciona un tipo...</option>
                  {BUSINESS_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Grupo 2: Productos */}
          <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Tag className="h-[18px] w-[18px]" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Agrega tu primer producto</h2>
            </div>

            <div className="space-y-3">
              {products.map((product, index) => (
                <div key={product.id} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Producto {products.length > 1 ? `#${index + 1}` : ""}
                    </label>
                    <div className="relative">
                      <Package className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id={index === 0 ? "productName-0" : undefined}
                        ref={index === 0 ? productNameInputRef : undefined}
                        type="text"
                        placeholder="Nombre del producto"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                        value={product.name}
                        onChange={(e) => updateProduct(product.id, "name", e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="w-full space-y-1.5 sm:w-40">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Valor
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        placeholder="0.00"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                        value={product.price}
                        onChange={(e) => updateProduct(product.id, "price", e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  {products.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProduct(product.id)}
                      className="flex h-12 w-12 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addProduct}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3.5 font-semibold text-slate-500 transition hover:border-blue-500 hover:text-blue-600"
              disabled={isSubmitting}
            >
              <Plus className="h-[18px] w-[18px]" />
              <span>Agregar más productos</span>
            </button>
          </section>
        </div>

        {/* Columna Derecha / Mobile Bottom: Checklist y Publicar */}
        <div className="hidden lg:flex lg:h-full lg:items-center">
          <div className="space-y-5 w-full">
            <div
              className={`rounded-[1.75rem] border p-5 shadow-sm transition-all duration-300 ${
                canPublish
                  ? "border-emerald-200 bg-[linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,0.96))] shadow-emerald-100/60"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Tu progreso
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      canPublish
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {canPublish ? "Listo para salir" : currentStep.label}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{progressHeadline}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{progressDetail}</p>
              </div>
               
              <ul className="space-y-3">
                {stepsWithStatus.map((step) => (
                  <ChecklistItem
                    key={step.key}
                    label={step.label}
                    helper={step.helper}
                    status={step.status ?? "pending"}
                  />
                ))}
              </ul>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish || isSubmitting}
                className={`group flex h-12 w-full items-center justify-center gap-3 rounded-xl px-6 font-bold text-white transition-all ${
                  canPublish && !isSubmitting
                    ? "bg-[linear-gradient(135deg,#047857_0%,#10b981_100%)] shadow-[0_18px_34px_rgba(4,120,87,0.24)] ring-1 ring-emerald-700/10 hover:brightness-[1.02] active:scale-[0.99]"
                    : "cursor-not-allowed bg-slate-300 shadow-none"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Publicando...</span>
                  </>
                ) : (
                  <>
                    <span>Publicar negocio</span>
                    {canPublish ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <ArrowRight className={`h-5 w-5 transition-transform ${canPublish ? "group-hover:translate-x-1" : ""}`} />
                    )}
                  </>
                )}
              </button>
              
              {isBusinessNameValid && !isSubmitting && (
                <p className="mt-2.5 text-center text-xs text-slate-400">
                  Tu enlace será: <span className="font-semibold">tecpify.com/{createSlugFromBusinessName(businessName)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-xl lg:hidden">
          <div
            className={`mx-auto max-w-7xl px-4 transition-[padding,opacity,transform] duration-200 ease-out sm:px-6 ${mobileFooterShellClassName}`}
          >
            <div
            className={`rounded-[1.35rem] border transition-[padding,box-shadow,background-color,border-color,transform,opacity] duration-200 ease-out ${mobileFooterCardClassName} ${
              mobileFooterMode === "compact" ? "translate-y-[1px]" : "translate-y-0"
            } ${
              canPublish
                ? "border-emerald-200 bg-[linear-gradient(180deg,_rgba(236,253,245,0.96),_rgba(255,255,255,0.98))]"
                : "border-slate-200 bg-white/95"
            }`}
          >
            <div
              className={`flex items-start justify-between gap-3 transition-[margin,opacity] duration-200 ease-out ${mobileFooterHeaderClassName} ${
                mobileFooterMode === "compact" ? "opacity-[0.92]" : "opacity-100"
              }`}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Tu progreso
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {canPublish ? "4 de 4 pasos listos" : progressHeadline}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  canPublish
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {canPublish ? "4 de 4" : `${completedStepsCount} de 4`}
              </span>
            </div>

            <div
              className={`flex items-center gap-2 transition-[margin,opacity,transform] duration-200 ease-out ${mobileFooterProgressClassName} ${
                mobileFooterMode === "compact" ? "opacity-95" : "opacity-100"
              }`}
              aria-label="Progreso del onboarding"
            >
              {stepsWithStatus.map((step) => (
                <span
                  key={step.key}
                  className={`rounded-full transition-all duration-300 ${
                    step.status === "completed"
                      ? "h-2.5 w-2.5 bg-emerald-500"
                      : step.status === "ready"
                        ? "h-2.5 w-7 bg-[linear-gradient(90deg,#10b981_0%,#34d399_100%)] shadow-[0_0_0_4px_rgba(209,250,229,0.95)]"
                        : step.status === "current"
                          ? "h-2.5 w-7 bg-blue-600 shadow-[0_0_0_4px_rgba(219,234,254,0.9)]"
                          : "h-2.5 w-2.5 bg-slate-200"
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>

            <p
              className={`text-xs leading-5 text-slate-500 transition-[margin,opacity,max-height,transform] duration-200 ease-out ${
                mobileFooterDescriptionClassName
              }`}
            >
              {mobileFooterMode === "compact"
                ? `${completedStepsCount} de 4 · ${canPublish ? "Listo para publicar." : currentStep.label}`
                : canPublish
                  ? "Todo listo para publicar."
                  : progressDetail}
            </p>

            <div
              className={`overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out ${mobileFooterActionWrapperClassName}`}
              aria-hidden={mobileFooterMode === "compact"}
            >
              <button
                type="button"
                onClick={() => focusMobileTarget(mobilePrimaryAction.target)}
                disabled={isSubmitting}
                className={`flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold transition-all duration-200 ${
                  canPublish && !isSubmitting
                    ? "bg-[linear-gradient(135deg,#047857_0%,#10b981_100%)] text-white shadow-[0_18px_34px_rgba(4,120,87,0.24)] ring-1 ring-emerald-700/10 active:scale-[0.99]"
                    : "bg-slate-100 text-slate-900"
                } ${mobileFooterMode === "compact" ? "pointer-events-none" : ""}`}
              >
                {isSubmitting ? (
                  "Publicando..."
                ) : canPublish ? (
                  <>
                    <CheckCircle2 className="mr-2 h-[18px] w-[18px]" />
                    <span>Publicar negocio</span>
                  </>
                ) : (
                  mobilePrimaryAction.label
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({
  label,
  helper,
  status,
}: {
  label: string;
  helper: string;
  status: OnboardingStepStatus;
}) {
  const isCompleted = status === "completed";
  const isCurrent = status === "current";
  const isReady = status === "ready";

  return (
    <li
      className={`rounded-2xl border px-3 py-3 transition-all duration-300 ${
        isReady
          ? "border-emerald-200 bg-white shadow-[0_8px_20px_rgba(16,185,129,0.08)]"
          : isCurrent
            ? "border-blue-200 bg-blue-50/80 shadow-[0_8px_20px_rgba(59,130,246,0.08)]"
            : isCompleted
              ? "border-emerald-100 bg-emerald-50/70"
              : "border-transparent bg-white/70"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-5 w-5 items-center justify-center">
          {isCompleted ? (
            <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" />
          ) : isReady ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[linear-gradient(135deg,#047857_0%,#10b981_100%)] text-white shadow-[0_0_0_4px_rgba(209,250,229,0.95)]">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          ) : isCurrent ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-blue-200 bg-white">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
            </span>
          ) : (
            <Circle className="h-[18px] w-[18px] text-slate-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                isReady || isCurrent || isCompleted ? "text-slate-900" : "text-slate-400"
              }`}
            >
              {label}
            </span>
            {isCompleted ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Listo
              </span>
            ) : null}
            {isCurrent ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                Actual
              </span>
            ) : null}
            {isReady ? (
              <span className="rounded-full bg-[linear-gradient(135deg,#047857_0%,#10b981_100%)] px-2 py-0.5 text-[11px] font-semibold text-white shadow-[0_0_0_4px_rgba(209,250,229,0.95)]">
                Cierre
              </span>
            ) : null}
          </div>

          {(isCurrent || isReady) && (
            <p className="mt-1.5 text-xs leading-5 text-slate-500">{helper}</p>
          )}
        </div>
      </div>
    </li>
  );
}
