"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createBusinessViaApi } from "@/lib/businesses/api";
import { createSlugFromBusinessName, normalizeBusinessSlug } from "@/lib/businesses/slug";

interface FormErrors {
  name?: string;
  businessSlug?: string;
  form?: string;
}

function validateForm(name: string, businessSlug: string): FormErrors {
  const errors: FormErrors = {};

  if (!name.trim()) {
    errors.name = "Ingresa el nombre del negocio.";
  } else if (name.trim().replace(/\s+/g, " ").length > 80) {
    errors.name = "El nombre no puede superar 80 caracteres.";
  }

  if (!normalizeBusinessSlug(businessSlug)) {
    errors.businessSlug = "Ingresa un slug publico valido con letras o numeros.";
  } else if (normalizeBusinessSlug(businessSlug).length > 60) {
    errors.businessSlug = "El slug publico no puede superar 60 caracteres.";
  }

  return errors;
}

export function CreateBusinessPanel() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [hasEditedBusinessSlugManually, setHasEditedBusinessSlugManually] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hasEditedBusinessSlugManually) {
      return;
    }

    setBusinessSlug(createSlugFromBusinessName(name));
  }, [hasEditedBusinessSlugManually, name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedBusinessSlug = normalizeBusinessSlug(businessSlug);
    const nextErrors = validateForm(name, normalizedBusinessSlug);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const business = await createBusinessViaApi({
        name: name.trim(),
        businessSlug: normalizedBusinessSlug,
      });

      router.push(`/dashboard/${business.businessSlug}?onboarding=create-product`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No fue posible crear el negocio.";

      setErrors({
        form: message,
        businessSlug: message.toLowerCase().includes("slug") ? message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="rounded-[32px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7"
      data-testid="create-business-panel"
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
          Alta basica
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Crear negocio real</h2>
        <p className="text-sm leading-6 text-slate-600">
          Crea el negocio y te llevamos directo al primer producto. La ruta mas corta al primer
          pedido empieza aqui.
        </p>
      </div>

      <div className="mt-5 grid gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4 sm:grid-cols-3">
        <article className="rounded-[18px] border border-white/80 bg-white/90 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Paso 1
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-950">Crear negocio</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Nombre y slug publico para abrir el espacio operativo.
          </p>
        </article>
        <article className="rounded-[18px] border border-white/80 bg-white/90 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Paso 2
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-950">Cargar primer producto</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Solo necesitas nombre, precio y dejarlo activo.
          </p>
        </article>
        <article className="rounded-[18px] border border-white/80 bg-white/90 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Paso 3
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-950">Probar el link publico</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Haces un pedido corto y ya validas el circuito real.
          </p>
        </article>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Nombre del negocio</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name || errors.form) {
                setErrors((currentErrors) => ({
                  ...currentErrors,
                  name: undefined,
                  form: undefined,
                }));
              }
            }}
            placeholder="Ej. Panaderia La Estacion"
            data-testid="business-name-input"
            className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-950 outline-none transition ${
              errors.name ? "border-rose-300 bg-rose-50/60" : "border-slate-200 focus:border-slate-400"
            }`}
          />
          {errors.name ? <p className="text-sm text-rose-600">{errors.name}</p> : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Slug publico</span>
          <input
            value={businessSlug}
            onChange={(event) => {
              setHasEditedBusinessSlugManually(true);
              setBusinessSlug(event.target.value);
              if (errors.businessSlug || errors.form) {
                setErrors((currentErrors) => ({
                  ...currentErrors,
                  businessSlug: undefined,
                  form: undefined,
                }));
              }
            }}
            placeholder="panaderia-la-estacion"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-testid="business-slug-input"
            className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-950 outline-none transition ${
              errors.businessSlug
                ? "border-rose-300 bg-rose-50/60"
                : "border-slate-200 focus:border-slate-400"
            }`}
          />
          <p className="text-xs leading-5 text-slate-500">
            Se normaliza en minusculas, con guiones y sin caracteres invalidos. Si no lo editas,
            se genera automaticamente desde el nombre.
          </p>
          {errors.businessSlug ? (
            <p className="text-sm text-rose-600">{errors.businessSlug}</p>
          ) : null}
        </label>

        {errors.form && !errors.businessSlug ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.form}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="create-business-submit-button"
          className={`w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
            isSubmitting
              ? "cursor-not-allowed bg-slate-400"
              : "bg-slate-950 hover:bg-slate-800"
          }`}
        >
          {isSubmitting ? "Creando negocio..." : "Crear negocio y abrir primer producto"}
        </button>

        <p className="text-xs leading-5 text-slate-500">
          Despues de crear el negocio te llevamos directo al workspace operativo con el drawer
          listo para cargar el primer producto.
        </p>
      </form>
    </section>
  );
}
