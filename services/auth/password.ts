import bcrypt from "bcryptjs";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, passwordHash: string) {
  return bcrypt.compare(plain, passwordHash);
}

export function validateNewPassword(password: string) {
  if (password.length < 10) return "Senha deve ter pelo menos 10 caracteres.";
  if (!/[a-z]/.test(password)) return "Senha deve conter uma letra minúscula.";
  if (!/[A-Z]/.test(password)) return "Senha deve conter uma letra maiúscula.";
  if (!/[0-9]/.test(password)) return "Senha deve conter um número.";
  if (!/[^a-zA-Z0-9]/.test(password))
    return "Senha deve conter um caractere especial.";
  return null;
}

