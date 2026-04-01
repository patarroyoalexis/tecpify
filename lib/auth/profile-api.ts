import type { UserProfile } from "./user-profiles";

export async function updateUserProfileViaApi(payload: { fullName: string }) {
  const response = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "No fue posible actualizar el perfil.");
  }

  const result = await response.json();
  return result.profile as UserProfile;
}

export async function deactivateUserProfileViaApi() {
  const response = await fetch("/api/auth/profile", {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "No fue posible cerrar la cuenta.");
  }

  return true;
}
