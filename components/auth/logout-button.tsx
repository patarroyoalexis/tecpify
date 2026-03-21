"use client";

import { useRouter } from "next/navigation";

interface LogoutButtonProps {
  className?: string;
  label?: string;
}

export function LogoutButton({
  className,
  label = "Cerrar sesion",
}: LogoutButtonProps) {
  const router = useRouter();
  const fallbackHref = "/login";

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.push(fallbackHref);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className={className}
    >
      {label}
    </button>
  );
}
