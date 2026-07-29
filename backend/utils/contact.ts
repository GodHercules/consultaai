import { normalizeText, onlyDigits } from "@/utils/strings";

export function normalizePhoneDigits(value: string | null | undefined) {
  if (value === null || value === undefined) return null;

  const digits = onlyDigits(String(value));
  if (!digits) return null;

  if (digits.length > 11 && digits.startsWith("55")) {
    const withoutCountryCode = digits.slice(2);
    if (withoutCountryCode.length >= 10 && withoutCountryCode.length <= 11) {
      return withoutCountryCode;
    }
  }

  return digits;
}

export function normalizePhoneDisplay(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeEmailAddress(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  return normalized.length ? normalized : null;
}

export function isValidEmailAddress(value: string | null | undefined) {
  const email = normalizeEmailAddress(value);
  if (!email) return false;

  // Keep the validation simple and stable for spreadsheet imports.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && normalizeText(email).includes("@");
}
