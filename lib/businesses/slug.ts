import type { BusinessSlug } from "@/types/identifiers";
import { isUuidLike } from "@/types/identifiers";

const INVALID_SLUG_CHARACTERS = /[^a-z0-9-]/g;
const REPEATED_HYPHENS = /-+/g;

export function normalizeBusinessSlug(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(INVALID_SLUG_CHARACTERS, "")
    .replace(REPEATED_HYPHENS, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseBusinessSlug(input: string): BusinessSlug | null {
  const normalizedBusinessSlug = normalizeBusinessSlug(input);

  if (!normalizedBusinessSlug || isUuidLike(normalizedBusinessSlug)) {
    return null;
  }

  return normalizedBusinessSlug as BusinessSlug;
}

export function requireBusinessSlug(input: string, label = "businessSlug"): BusinessSlug {
  const businessSlug = parseBusinessSlug(input);

  if (!businessSlug) {
    throw new Error(`El ${label} debe ser un slug publico valido y no puede parecer un UUID.`);
  }

  return businessSlug;
}

export function createSlugFromBusinessName(name: string) {
  return normalizeBusinessSlug(name);
}
