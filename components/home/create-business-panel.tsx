"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { createBusinessViaApi } from "@/lib/businesses/api";
import { createSlugFromBusinessName, normalizeBusinessSlug } from "@/lib/businesses/slug";

interface FormErrors {
  name?: string;
  slug?: string;
  form?: string;
}

function validateForm(name: string, slug: string): FormErrors {
  const errors: FormErrors = {};

  if (!name.trim()) {
    errors.name = "Ingresa el nombre del negocio.";
  }

  if (!normalizeBusinessSlug(slug)) {
    errors.slug = "Ingresa un slug valido con letras o numeros.";
  }

  return errors;
}

export function CreateBusinessPanel() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hasEditedSlugManually, setHasEditedSlugManually] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hasEditedSlugManually) {
      return;
    }

    setSlug(createSlugFromBusinessName(name));
  }, [hasEditedSlugManually, name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedSlug = normalizeBusinessSlug(slug);
    const nextErrors = validateForm(name, normalizedSlug);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const business = await createBusinessViaApi({
        name: name.trim(),
        slug: normalizedSlug,
      });

      router.push(`/dashboard/${business.slug}?onboarding=create-product`);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No fue posible crear el negocio.";

      setErrors({
        form: message,
        slug: message.toLowerCase().includes("slug") ? message : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-7">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
          Alta basica
        </p>
        <h2 className="text-2xl font-semibold text-slate-950">Crear negocio real</h2>
        <p className="text-sm leading-6 text-slate-600">
          Crea un negocio operativo en Supabase con nombre y slug. El catalogo se agrega despues.
        </p>
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
            className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-950 outline-none transition ${
              errors.name ? "border-rose-300 bg-rose-50/60" : "border-slate-200 focus:border-slate-400"
            }`}
          />
          {errors.name ? <p className="text-sm text-rose-600">{errors.name}</p> : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Slug</span>
          <input
            value={slug}
            onChange={(event) => {
              setHasEditedSlugManually(true);
              setSlug(event.target.value);
              if (errors.slug || errors.form) {
                setErrors((currentErrors) => ({
                  ...currentErrors,
                  slug: undefined,
                  form: undefined,
                }));
              }
            }}
            placeholder="panaderia-la-estacion"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-950 outline-none transition ${
              errors.slug ? "border-rose-300 bg-rose-50/60" : "border-slate-200 focus:border-slate-400"
            }`}
          />
          <p className="text-xs leading-5 text-slate-500">
            Se guarda normalizado en minusculas, con guiones y sin caracteres invalidos.
          </p>
          {errors.slug ? <p className="text-sm text-rose-600">{errors.slug}</p> : null}
        </label>

        {errors.form && !errors.slug ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.form}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
            isSubmitting
              ? "cursor-not-allowed bg-slate-400"
              : "bg-slate-950 hover:bg-slate-800"
          }`}
        >
          {isSubmitting ? "Creando negocio..." : "Crear negocio"}
        </button>
      </form>
    </section>
  );
}
