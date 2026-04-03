"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  LockKeyhole,
  Mail,
} from "lucide-react";

import {
  AuthAlert,
  AuthDivider,
  AuthGoogleButton,
  AuthInputField,
  AuthPrimaryButton,
} from "@/components/auth/auth-form-ui";

interface LoginFormProps {
  redirectTo: string | null;
  hasExplicitRedirectTo: boolean;
  initialError?: string | null;
  googleAuthHref?: string | null;
}

export function LoginForm({
  redirectTo,
  hasExplicitRedirectTo,
  initialError = null,
  googleAuthHref = null,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setError(initialError ?? "");
  }, [initialError]);

  function navigateAfterAuth(destination: string) {
    window.location.assign(destination);
  }

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
          redirectTo: hasExplicitRedirectTo ? redirectTo : null,
          hasExplicitRedirectTo,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible iniciar sesión.");
      }

      navigateAfterAuth(payload.redirectTo ?? "/onboarding");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No fue posible iniciar sesión.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
      <AuthInputField
        type="email"
        label="Correo"
        icon={<Mail className="h-4 w-4" aria-hidden="true" />}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="tu-correo@tu-negocio.com"
        dataTestId="login-email-input"
      />

      <AuthInputField
        type="password"
        label="Contraseña"
        icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        placeholder="Tu contraseña"
        dataTestId="login-password-input"
      />

      {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

      <AuthPrimaryButton
        disabled={isSubmitting}
        isLoading={isSubmitting}
        dataTestId="login-submit-button"
        variant="login"
      >
        {isSubmitting ? "Ingresando..." : "Entrar"}
      </AuthPrimaryButton>

      {googleAuthHref ? (
        <>
          <AuthDivider label="o usa la opción secundaria" />
          <AuthGoogleButton
            href={googleAuthHref}
            dataTestId="login-google-auth-link"
            label="Entrar con Google"
          />
          <p
            data-testid="login-google-auth-secondary-copy"
            className="text-sm leading-6 text-brand-text-muted"
          >
            Google es opcional en este entorno. Si no está habilitado, sigue con correo y contraseña.
          </p>
        </>
      ) : null}

      <p className="text-sm leading-6 text-brand-text-muted">
        ¿Eres nuevo? Empieza por el{" "}
        <Link
          href="/onboarding"
          prefetch={false}
          className="font-semibold text-brand-primary-blue underline-offset-4 transition hover:text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.5)]"
        >
          onboarding rápido
        </Link>
        .
      </p>

      <p className="text-sm leading-6 text-brand-text-muted">
        Si necesitas abrir una cuenta nueva, usa el{" "}
        <Link
          href={
            hasExplicitRedirectTo && redirectTo
              ? `/register?redirectTo=${encodeURIComponent(redirectTo)}`
              : "/register"
          }
          data-testid="login-register-secondary-link"
          className="font-semibold text-brand-primary-blue underline-offset-4 transition hover:text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.5)]"
        >
          registro manual
        </Link>
        {" "}como carril secundario.
      </p>
    </form>
  );
}
