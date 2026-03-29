"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import {
  AuthAlert,
  AuthDivider,
  AuthGoogleButton,
  AuthInputField,
  AuthPrimaryButton,
} from "@/components/auth/auth-form-ui";

interface RegisterFormProps {
  redirectTo: string;
  initialError?: string | null;
  googleAuthHref?: string | null;
}

export function RegisterForm({
  redirectTo,
  initialError = null,
  googleAuthHref = null,
}: RegisterFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setError(initialError ?? "");
    setSuccessMessage("");
  }, [initialError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Las passwords no coinciden.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/auth/register", {
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
        requiresEmailConfirmation?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible crear la cuenta.");
      }

      if (payload.requiresEmailConfirmation) {
        setSuccessMessage(
          payload.message ??
            "Tu cuenta fue creada. Revisa tu correo para confirmar e iniciar sesion.",
        );
        return;
      }

      router.push(payload.redirectTo ?? redirectTo);
      router.refresh();
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "No fue posible crear la cuenta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="register-form">
      {googleAuthHref ? (
        <>
          <AuthGoogleButton
            href={googleAuthHref}
            dataTestId="register-google-auth-link"
            label="Crear cuenta con Google"
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
      />

      <AuthInputField
        type="password"
        label="Password"
        icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        placeholder="Minimo 8 caracteres"
      />

      <AuthInputField
        type="password"
        label="Confirmar password"
        icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        autoComplete="new-password"
        placeholder="Repite tu password"
      />

      {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

      {successMessage ? <AuthAlert tone="success">{successMessage}</AuthAlert> : null}

      <AuthPrimaryButton
        disabled={isSubmitting}
        isLoading={isSubmitting}
        variant="register"
      >
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </AuthPrimaryButton>

      <p className="text-sm leading-6 text-brand-text-muted">
        Ya tienes cuenta?{" "}
        <Link
          href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-brand-primary-green underline-offset-4 transition hover:text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.5)]"
        >
          Inicia sesion
        </Link>
      </p>
    </form>
  );
}
