import { onlyDigits } from "@/utils/strings";

export function normalizeCpf(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = onlyDigits(String(raw));
  return digits.length ? digits : null;
}

function calcVerifier(base: number[]) {
  let sum = 0;
  for (let index = 0; index < base.length; index += 1) {
    sum += base[index] * (base.length + 1 - index);
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function isValidCpf(cpf: string | null | undefined) {
  const digits = normalizeCpf(cpf);
  if (!digits || digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const numbers = digits.split("").map((digit) => Number(digit));
  const d1 = calcVerifier(numbers.slice(0, 9));
  const d2 = calcVerifier(numbers.slice(0, 10));

  return d1 === numbers[9] && d2 === numbers[10];
}
