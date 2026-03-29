import type { InputHTMLAttributes, ReactNode } from "react";

type AuthVariant = "login" | "register";
type AuthAlertTone = "error" | "success";

interface AuthInputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: ReactNode;
  dataTestId?: string;
}

interface AuthGoogleButtonProps {
  href: string;
  label: string;
  dataTestId?: string;
}

interface AuthAlertProps {
  tone: AuthAlertTone;
  children: ReactNode;
}

interface AuthPrimaryButtonProps {
  children: ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  dataTestId?: string;
  variant: AuthVariant;
}

const primaryButtonShadowByVariant: Record<AuthVariant, string> = {
  login: "0 18px 36px rgb(var(--brand-primary-green-rgb) / 0.26)",
  register: "0 18px 36px rgb(var(--brand-primary-blue-rgb) / 0.22)",
};

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.53 5.53 0 0 1-2.39 3.63v3.02h3.87c2.27-2.09 3.55-5.17 3.55-8.68Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3.02c-1.07.72-2.44 1.15-4.08 1.15-3.14 0-5.79-2.12-6.74-4.98H1.26v3.12A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.25A7.2 7.2 0 0 1 4.89 12c0-.78.13-1.54.37-2.25V6.63H1.26A11.99 11.99 0 0 0 0 12c0 1.93.46 3.75 1.26 5.37l4-3.12Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.14 15.23 0 12 0A11.99 11.99 0 0 0 1.26 6.63l4 3.12c.95-2.86 3.6-4.98 6.74-4.98Z"
      />
    </svg>
  );
}

export function AuthInputField({
  label,
  icon,
  dataTestId,
  className,
  ...inputProps
}: AuthInputFieldProps) {
  const inputClassName = [
    "h-14 w-full rounded-[1.35rem] border border-brand-border bg-brand-surface px-4 pl-12 text-[0.95rem] text-brand-text shadow-[0_14px_34px_rgb(var(--brand-primary-blue-rgb)/0.08)] outline-none transition",
    "placeholder:text-brand-text-muted/70 hover:border-brand-focus hover:bg-white focus:border-brand-focus focus:bg-white focus-visible:ring-4 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.48)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="grid gap-2.5">
      <span className="text-sm font-semibold text-brand-text">{label}</span>
      <span className="relative flex items-center">
        <span className="pointer-events-none absolute left-4 text-brand-text-muted">{icon}</span>
        <input {...inputProps} data-testid={dataTestId} className={inputClassName} />
      </span>
    </label>
  );
}

export function AuthGoogleButton({
  href,
  label,
  dataTestId,
}: AuthGoogleButtonProps) {
  return (
    <a
      href={href}
      data-testid={dataTestId}
      className="group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-[1.35rem] border border-brand-border bg-brand-surface px-5 py-3 text-sm font-semibold text-brand-text shadow-[0_16px_38px_rgb(var(--brand-primary-blue-rgb)/0.08)] transition hover:-translate-y-px hover:border-brand-focus hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.48)]"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-surface-muted">
        <GoogleIcon />
      </span>
      <span>{label}</span>
      <span className="text-brand-text-muted transition group-hover:translate-x-0.5" aria-hidden="true">
        -&gt;
      </span>
    </a>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-brand-text-muted/75">
      <span className="h-px flex-1 bg-brand-border" />
      <span>o sigue con email</span>
      <span className="h-px flex-1 bg-brand-border" />
    </div>
  );
}

export function AuthAlert({ tone, children }: AuthAlertProps) {
  const toneClassName =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[1.35rem] border px-4 py-3 text-sm ${toneClassName}`}
    >
      {children}
    </div>
  );
}

export function AuthPrimaryButton({
  children,
  disabled = false,
  isLoading = false,
  dataTestId,
  variant,
}: AuthPrimaryButtonProps) {
  const variantClassName =
    variant === "login"
      ? "bg-brand-primary-green text-white"
      : "bg-brand-primary-blue text-white";

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={isLoading}
      data-testid={dataTestId}
      className={`inline-flex min-h-14 w-full items-center justify-center rounded-[1.35rem] px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgb(var(--brand-focus-rgb)/0.55)] ${variantClassName} ${
        disabled
          ? "cursor-not-allowed opacity-65 shadow-none"
          : "hover:-translate-y-px hover:brightness-95"
      }`}
      style={{
        boxShadow: disabled ? "none" : primaryButtonShadowByVariant[variant],
      }}
    >
      {children}
    </button>
  );
}
