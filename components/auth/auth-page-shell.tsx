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
      "La experiencia de acceso queda mas limpia y enfocada para volver rápido al panel privado sin ruido visual.",
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
