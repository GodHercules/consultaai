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

