import bcrypt from "bcryptjs";
import { getPasswordStrength, type PasswordStrength } from "@/lib/password-strength";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, passwordHash: string) {
  return bcrypt.compare(plain, passwordHash);
}

function strengthLabel(level: PasswordStrength) {
  switch (level) {
    case "strong":
      return "Senha forte obrigatória: use pelo menos 12 caracteres com maiúsculas, minúsculas, números e símbolos.";
    case "moderate":
      return "Senha moderada: funciona, mas ainda não atende ao mínimo forte exigido.";
    case "weak":
    default:
      return "Senha fraca: precisa de mais tamanho e mais variedade de caracteres.";
  }
}

export function validateNewPassword(password: string, minimumStrength: PasswordStrength = "strong") {
  const strength = getPasswordStrength(password);
  const order: Record<PasswordStrength, number> = { weak: 0, moderate: 1, strong: 2 };

  if (order[strength.level] < order[minimumStrength]) {
    return strengthLabel(minimumStrength);
  }

  return null;
}
