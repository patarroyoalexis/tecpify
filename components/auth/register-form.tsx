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
  AuthInputField,
  AuthPrimaryButton,
} from "@/components/auth/auth-form-ui";

interface RegisterFormProps {
  redirectTo: string;
  initialError?: string | null;
}

export function RegisterForm({
  redirectTo,
  initialError = null,
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
      <div
        data-testid="register-secondary-warning"
        className="rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Este registro manual permanece disponible solo como carril secundario.
        Puede requerir confirmacion de correo y configuracion real de Supabase Auth
        antes de dejar operativo el login. Si este entorno habilita Google, ese
        carril opcional se intenta solo desde /login.
      </div>

      <AuthInputField
        type="email"
        label="Email"
        icon={<Mail className="h-4 w-4" aria-hidden="true" />}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="tu-correo@tu-negocio.com"
      />

      <AuthInputField
        type="password"
        label="Contrasena"
        icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        placeholder="Contraseña"
      />

      <AuthInputField
        type="password"
        label="Confirmar contrasena"
        icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        autoComplete="new-password"
        placeholder="Repite tu contraseña"
      />

      {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

      {successMessage ? <AuthAlert tone="success">{successMessage}</AuthAlert> : null}

      <AuthPrimaryButton
        disabled={isSubmitting}
        isLoading={isSubmitting}
        dataTestId="register-submit-button"
        variant="register"
      >
        {isSubmitting ? "Intentando registro..." : "Intentar registro manual"}
      </AuthPrimaryButton>

      <p className="text-sm leading-6 text-brand-text-muted">
        Si ya tienes un acceso operativo,{" "}
        <Link
          href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-brand-primary-green underline-offset-4 transition hover:text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.5)]"
        >
          inicia sesion
        </Link>
        .
      </p>
    </form>
  );
}
