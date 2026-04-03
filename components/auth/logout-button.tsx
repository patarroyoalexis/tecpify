"use client";


interface LogoutButtonProps {
  className?: string;
  label?: string;
}

export function LogoutButton({
  className,
  label = "Cerrar sesión",
}: LogoutButtonProps) {
  const fallbackHref = "/login";

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.assign(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      data-testid="logout-button"
      className={className}
    >
      {label}
    </button>
  );
}
