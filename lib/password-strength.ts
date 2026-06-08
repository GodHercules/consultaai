export type PasswordStrength = "weak" | "moderate" | "strong";

export function getPasswordStrength(password: string) {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const hasWhitespace = /\s/.test(password);
  const length = password.length;
  const classes = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;

  let level: PasswordStrength = "weak";
  if (!hasWhitespace && length >= 12 && classes >= 4) {
    level = "strong";
  } else if (!hasWhitespace && length >= 10 && classes >= 3) {
    level = "moderate";
  }

  return {
    level,
    length,
    hasLower,
    hasUpper,
    hasNumber,
    hasSpecial,
    hasWhitespace,
    classes,
  };
}
