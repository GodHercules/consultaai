export function onlyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeKeyText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;

  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return normalized.length ? normalized : null;
}
