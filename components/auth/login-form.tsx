"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
      {googleAuthHref ? (
        <>
          <AuthGoogleButton
            href={googleAuthHref}
            dataTestId="login-google-auth-link"
            label="Continuar con Google"
          />
          <AuthDivider />
        </>
      ) : null}

      <AuthInputField
        type="email"
        label="Email"
        icon={<Mail className="h-4 w-4" aria-hidden="true" />}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="operacion@tu-negocio.com"
        dataTestId="login-email-input"
      />

      <AuthInputField
        type="password"
        label="Password"
        icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        placeholder="Tu password de Supabase Auth"
        dataTestId="login-password-input"
      />

      {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

      <AuthPrimaryButton
        disabled={isSubmitting}
        isLoading={isSubmitting}
        dataTestId="login-submit-button"
        variant="login"
      >
        {isSubmitting ? "Ingresando..." : "Iniciar sesion"}
      </AuthPrimaryButton>

      <p className="text-sm leading-6 text-brand-text-muted">
        Todavia no tienes cuenta?{" "}
        <Link
          href={`/register?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-brand-primary-blue underline-offset-4 transition hover:text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.5)]"
        >
          Crear acceso
        </Link>
      </p>
    </form>
  );
}
