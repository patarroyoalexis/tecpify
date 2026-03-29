import Image from "next/image";
import type { ReactNode } from "react";

type AuthPageVariant = "login" | "register";

interface AuthPageShellProps {
  children: ReactNode;
  formDescription: ReactNode;
  formEyebrow: string;
  formTitle: string;
  redirectTo: string;
  variant: AuthPageVariant;
}


function getAccentStyles(variant: AuthPageVariant) {
  if (variant === "login") {
    return {
      badge: {
        backgroundColor: "rgb(var(--brand-primary-green-rgb) / 0.14)",
        color: "var(--brand-primary-green)",
      },
      orbPrimary: {
        backgroundColor: "rgb(var(--brand-primary-green-rgb) / 0.22)",
      },
      orbSecondary: {
        backgroundColor: "rgb(var(--brand-primary-blue-rgb) / 0.14)",
      },
      miniCard: {
        backgroundColor: "rgb(var(--brand-primary-green-rgb) / 0.1)",
        borderColor: "rgb(var(--brand-primary-green-rgb) / 0.14)",
      },
    };
  }

  return {
    badge: {
      backgroundColor: "rgb(var(--brand-primary-blue-rgb) / 0.14)",
      color: "var(--brand-primary-blue)",
    },
    orbPrimary: {
      backgroundColor: "rgb(var(--brand-primary-blue-rgb) / 0.22)",
    },
    orbSecondary: {
      backgroundColor: "rgb(var(--brand-primary-green-rgb) / 0.12)",
    },
    miniCard: {
      backgroundColor: "rgb(var(--brand-primary-blue-rgb) / 0.08)",
      borderColor: "rgb(var(--brand-primary-blue-rgb) / 0.12)",
    },
  };
}

export function AuthPageShell({
  children,
  formDescription,
  formEyebrow,
  formTitle,
  redirectTo,
  variant,
}: AuthPageShellProps) {
  const accentStyles = getAccentStyles(variant);

  return (
    <main className={`auth-page auth-page--${variant} px-4 py-8 sm:px-6`}>
      <div className="mx-auto flex min-h-[calc(100vh-16rem)] w-full max-w-6xl items-center">
        <section className="auth-shell grid w-full items-stretch gap-5 p-3 sm:gap-6 sm:p-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(340px,1.18fr)] lg:p-5">
          <div className="rounded-[2rem] border border-brand-border/75 bg-[rgb(var(--brand-surface-rgb)/0.96)] p-5 shadow-[0_24px_60px_rgb(var(--brand-primary-blue-rgb)/0.12)] sm:p-6 lg:p-7">
            <span
              className="inline-flex items-center rounded-full border border-transparent px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em]"
              style={accentStyles.badge}
            >
              {formEyebrow}
            </span>

            <h1 className="mt-4 text-[1.75rem] font-semibold tracking-[-0.04em] text-brand-text sm:text-[2rem]">
              {formTitle}
            </h1>

            <div className="mt-3 text-sm leading-6 text-brand-text-muted sm:text-[0.95rem]">
              {formDescription}
            </div>

            <div className="mt-6">{children}</div>
          </div>
          <aside className="relative overflow-hidden rounded-[2rem] border border-brand-border/70 bg-[linear-gradient(160deg,rgb(var(--brand-surface-rgb)/0.96)_0%,rgb(var(--brand-surface-muted-rgb)/0.94)_48%,rgb(var(--brand-surface-rgb)/0.98)_100%)] p-0 shadow-[0_28px_70px_rgb(var(--brand-primary-blue-rgb)/0.12)] sm:p-8 lg:p-8">
                  <Image
                    src="/images/landing/login-tecpify.png"
                    alt="Vista de Tecpify con dashboard, catalogo y pedidos."
                    width={1200}
                    height={1200}
                    priority
                    className="h-auto w-full rounded-[1.3rem] object-cover shadow-[0_28px_70px_rgb(var(--brand-primary-blue-rgb)/0.12)]"
                  />
          </aside>
        </section>
      </div>
    </main>
  );
}
