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

export function createSlugFromBusinessName(name: string) {
  return normalizeBusinessSlug(name);
}
