"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface RegisterFormProps {
  redirectTo: string;
}

export function RegisterForm({ redirectTo }: RegisterFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="operacion@tu-negocio.com"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="Minimo 8 caracteres"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Confirmar password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          placeholder="Repite tu password"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
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
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <p className="text-sm text-slate-600">
        ¿Ya tienes cuenta?{" "}
        <Link href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`} className="font-semibold text-slate-900">
          Inicia sesion
        </Link>
      </p>
    </form>
  );
}
