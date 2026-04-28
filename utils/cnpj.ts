import { onlyDigits } from "@/utils/strings";

export function normalizeCnpj(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = onlyDigits(String(raw));
  if (digits.length === 0) return null;
  return digits;
}

export function cnpjRaiz(cnpjNumerico: string) {
  return cnpjNumerico.slice(0, 8);
}

function calcVerifier(base: number[], weights: number[]) {
  const sum = base.reduce((acc, n, idx) => acc + n * weights[idx], 0);
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function isValidCnpj(cnpjNumerico: string) {
  const digits = normalizeCnpj(cnpjNumerico);
  if (!digits || digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const nums = digits.split("").map((c) => Number(c));
  const base12 = nums.slice(0, 12);
  const d1 = calcVerifier(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const base13 = [...base12, d1];
  const d2 = calcVerifier(base13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return d1 === nums[12] && d2 === nums[13];
}

