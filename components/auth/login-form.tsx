"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  redirectTo: string;
  initialError?: string | null;
  googleAuthHref?: string | null;
}

export function LoginForm({
  redirectTo,
  initialError = null,
  googleAuthHref = null,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setError(initialError ?? "");
  }, [initialError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          redirectTo,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible iniciar sesion.");
      }

      router.push(payload.redirectTo ?? redirectTo);
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No fue posible iniciar sesion.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4" data-testid="login-form">
      {googleAuthHref ? (
        <>
          <a
            href={googleAuthHref}
            data-testid="login-google-auth-link"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-900 transition hover:border-sky-300 hover:bg-sky-100"
          >
            Continuar con Google
          </a>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>o sigue con email</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="operacion@tu-negocio.com"
          data-testid="login-email-input"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Tu password de Supabase Auth"
          data-testid="login-password-input"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        data-testid="login-submit-button"
        className={`w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
          isSubmitting
            ? "cursor-not-allowed bg-slate-400"
            : "bg-slate-950 hover:bg-slate-800"
        }`}
      >
        {isSubmitting ? "Ingresando..." : "Iniciar sesion"}
      </button>

      <p className="text-sm text-slate-600">
        ¿Todavia no tienes cuenta?{" "}
        <Link
          href={`/register?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-slate-900"
        >
          Crear acceso
        </Link>
      </p>
    </form>
  );
}
