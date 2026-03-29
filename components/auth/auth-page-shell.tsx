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

const pageContent: Record<
  AuthPageVariant,
  {
    visualEyebrow: string;
    visualTitle: string;
    visualDescription: string;
    statLabel: string;
    statValue: string;
    supportItems: Array<{ title: string; body: string }>;
  }
> = {
  login: {
    visualEyebrow: "Acceso operativo",
    visualTitle: "Retoma pedidos, catalogo y metricas desde una sola entrada clara.",
    visualDescription:
      "La experiencia de acceso queda mas limpia y enfocada para volver rapido al panel privado sin ruido visual.",
    statLabel: "Estado del acceso",
    statValue: "Protegido con Auth SSR",
    supportItems: [
      {
        title: "Operacion continua",
        body: "Entra, revisa pedidos nuevos y sigue el trabajo sin buscar enlaces ni atajos.",
      },
      {
        title: "Contexto privado",
        body: "El dashboard operativo sigue aislado y te devuelve directo a la ruta que esperabas.",
      },
    ],
  },
  register: {
    visualEyebrow: "Registro operativo",
    visualTitle: "Crea tu acceso y deja lista una base profesional para empezar a operar.",
    visualDescription:
      "El alta mantiene el flujo real del producto, pero ahora con una presentacion mas solida y consistente con la marca.",
    statLabel: "Alta inicial",
    statValue: "Ownership listo para comenzar",
    supportItems: [
      {
        title: "Arranque ordenado",
        body: "Crea la cuenta, activa el negocio y deja lista la base para publicar y gestionar pedidos.",
      },
      {
        title: "Imagen mas confiable",
        body: "El espacio transmite un tono moderno y profesional antes del primer paso operativo.",
      },
    ],
  },
};

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
  const content = pageContent[variant];
  const accentStyles = getAccentStyles(variant);

  return (
    <main className={`auth-page auth-page--${variant} px-4 py-8 sm:px-6`}>
      <div className="mx-auto flex min-h-[calc(100vh-16rem)] w-full max-w-6xl items-center">
        <section className="auth-shell grid w-full items-stretch gap-5 p-3 sm:gap-6 sm:p-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(340px,1.18fr)] lg:p-5">
          <div className="rounded-[2rem] border border-brand-border/75 bg-[rgb(var(--brand-surface-rgb)/0.96)] p-6 shadow-[0_24px_60px_rgb(var(--brand-primary-blue-rgb)/0.12)] sm:p-8 lg:p-9">
            <span
              className="inline-flex items-center rounded-full border border-transparent px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
              style={accentStyles.badge}
            >
              {formEyebrow}
            </span>
            <h1 className="mt-5 text-[2rem] font-semibold tracking-[-0.04em] text-brand-text sm:text-[2.35rem]">
              {formTitle}
            </h1>
            <div className="mt-4 text-sm leading-7 text-brand-text-muted sm:text-[0.97rem]">
              {formDescription}
            </div>

            <div className="mt-8">{children}</div>
          </div>

          <aside className="relative overflow-hidden rounded-[2rem] border border-brand-border/70 bg-[linear-gradient(160deg,rgb(var(--brand-surface-rgb)/0.96)_0%,rgb(var(--brand-surface-muted-rgb)/0.94)_48%,rgb(var(--brand-surface-rgb)/0.98)_100%)] p-6 shadow-[0_28px_70px_rgb(var(--brand-primary-blue-rgb)/0.12)] sm:p-8 lg:p-9">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full blur-3xl"
              style={accentStyles.orbPrimary}
            />
            <div
              className="pointer-events-none absolute -bottom-14 left-0 h-52 w-52 rounded-full blur-3xl"
              style={accentStyles.orbSecondary}
            />

            <div className="relative flex h-full flex-col gap-8">
              <div>
                <Image
                  src="/images/landing/Tecpify-logo.png"
                  alt="Tecpify"
                  width={160}
                  height={42}
                  priority
                  className="h-10 w-auto"
                />
                <span
                  className="mt-6 inline-flex items-center rounded-full border border-transparent px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
                  style={accentStyles.badge}
                >
                  {content.visualEyebrow}
                </span>
                <h2 className="mt-5 max-w-xl text-[1.9rem] font-semibold leading-[1.02] tracking-[-0.04em] text-brand-text sm:text-[2.45rem]">
                  {content.visualTitle}
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-brand-text-muted sm:text-[0.97rem]">
                  {content.visualDescription}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {content.supportItems.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[1.5rem] border p-4 shadow-[0_16px_36px_rgb(var(--brand-primary-blue-rgb)/0.08)]"
                    style={accentStyles.miniCard}
                  >
                    <p className="text-sm font-semibold text-brand-text">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-brand-text-muted">{item.body}</p>
                  </article>
                ))}
              </div>

              <div className="relative mt-auto">
                <div className="relative overflow-hidden rounded-[1.75rem] border border-brand-border/80 bg-[rgb(var(--brand-surface-rgb)/0.78)] p-3 shadow-[0_22px_55px_rgb(var(--brand-primary-blue-rgb)/0.14)]">
                  <Image
                    src="/images/landing/hero-tecpify-square.png"
                    alt="Vista de Tecpify con dashboard, catalogo y pedidos."
                    width={1200}
                    height={1200}
                    priority
                    className="h-auto w-full rounded-[1.3rem] object-cover"
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="rounded-[1.35rem] border border-brand-border/80 bg-[rgb(var(--brand-surface-rgb)/0.9)] px-4 py-3 shadow-[0_16px_36px_rgb(var(--brand-primary-blue-rgb)/0.1)]">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-text-muted">
                      {content.statLabel}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-brand-text">{content.statValue}</p>
                  </div>
                  <div className="rounded-[1.35rem] border border-brand-border/80 bg-[rgb(var(--brand-surface-rgb)/0.9)] px-4 py-3 shadow-[0_16px_36px_rgb(var(--brand-primary-blue-rgb)/0.1)]">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-text-muted">
                      Despues
                    </p>
                    <p className="mt-2 max-w-[14rem] truncate text-sm font-semibold text-brand-text">
                      {redirectTo}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
