"use client";

import { useState, useEffect } from "react";
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

export function OnboardingFlow() {
  const router = useRouter();
  
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
    <div className="mx-auto max-w-7xl px-6 pb-20 sm:px-10 lg:px-8">
      {/* Layout Responsivo: 1 col en movil, 3 cols en desktop */}
      <div className="grid gap-12 lg:grid-cols-[1fr_2fr_1fr]">
        
        {/* Columna Izquierda: Mensaje amigable */}
        <div className="space-y-6 lg:pt-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Crea tu espacio de pedidos
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Empieza con lo básico y publica tu negocio en pocos minutos. Tecpify te ayuda a organizar tus productos y recibir pedidos de forma sencilla.
          </p>
          <div className="hidden lg:block pt-8 opacity-20">
             <Store className="h-32 w-32 text-blue-600" />
          </div>
        </div>

        {/* Columna Central: Formulario */}
        <div className="space-y-10">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          )}

          {/* Grupo 1: Negocio */}
          <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Store className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Tu negocio</h2>
            </div>
            
            <div className="grid gap-6">
              <div className="space-y-2">
                <label htmlFor="businessName" className="text-sm font-semibold text-slate-700 ml-1">
                  Nombre del negocio
                </label>
                <input
                  id="businessName"
                  type="text"
                  placeholder="Ej: Pastelería Doña Rosa"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="businessType" className="text-sm font-semibold text-slate-700 ml-1">
                  Tipo de negocio
                </label>
                <select
                  id="businessType"
                  className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
          <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Tag className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Agrega tu primer producto</h2>
            </div>

            <div className="space-y-4">
              {products.map((product, index) => (
                <div key={product.id} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
                      Producto {products.length > 1 ? `#${index + 1}` : ""}
                    </label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Nombre del producto"
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                        value={product.name}
                        onChange={(e) => updateProduct(product.id, "name", e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="w-full space-y-2 sm:w-40">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
                      Valor
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        placeholder="0.00"
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
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
                      className="flex h-14 w-14 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addProduct}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 font-semibold text-slate-500 transition hover:border-blue-500 hover:text-blue-600"
              disabled={isSubmitting}
            >
              <Plus className="h-5 w-5" />
              <span>Agregar más productos</span>
            </button>
          </section>
        </div>

        {/* Columna Derecha / Mobile Bottom: Checklist y Publicar */}
        <div className="lg:sticky lg:top-32 lg:h-fit space-y-8">
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Tu progreso</h3>
            
            <ul className="space-y-4">
              <ChecklistItem 
                label="Nombre del negocio" 
                isDone={isBusinessNameValid} 
              />
              <ChecklistItem 
                label="Tipo de negocio" 
                isDone={isBusinessTypeValid} 
              />
              <ChecklistItem 
                label="Agregar producto" 
                isDone={hasAtLeastOneProduct} 
              />
              <ChecklistItem 
                label="Publicar" 
                isDone={false} 
                isLast 
              />
            </ul>

            <div className="mt-10">
              <button
                type="button"
                onClick={handlePublish}
                disabled={!canPublish || isSubmitting}
                className={`group flex h-16 w-full items-center justify-center gap-3 rounded-2xl px-6 font-bold text-white transition-all ${
                  canPublish && !isSubmitting
                    ? "bg-slate-900 shadow-xl shadow-slate-900/10 hover:bg-slate-800 active:scale-95"
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
                    <ArrowRight className={`h-5 w-5 transition-transform ${canPublish ? "group-hover:translate-x-1" : ""}`} />
                  </>
                )}
              </button>
            </div>
            
            {isBusinessNameValid && !isSubmitting && (
              <p className="mt-4 text-center text-xs text-slate-400">
                Tu enlace será: <span className="font-semibold">tecpify.com/{createSlugFromBusinessName(businessName)}</span>
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function ChecklistItem({ label, isDone, isLast = false }: { label: string, isDone: boolean, isLast?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      {isDone ? (
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      ) : (
        <Circle className={`h-6 w-6 ${isLast ? "text-slate-300" : "text-slate-300"}`} />
      )}
      <span className={`text-sm font-medium ${isDone ? "text-slate-900" : "text-slate-400"}`}>
        {label}
      </span>
    </li>
  );
}
