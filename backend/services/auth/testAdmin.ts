const TEST_ADMIN_EMAIL_ALIASES = ["test.admin@local.com", "teste.admin@local.com"] as const;

export const TEST_ADMIN_CANONICAL_EMAIL = TEST_ADMIN_EMAIL_ALIASES[0];
export const TEST_ADMIN_DISPLAY_EMAIL = TEST_ADMIN_EMAIL_ALIASES[1];
export const TEST_ADMIN_DEFAULT_PASSWORD = process.env.DEFAULT_TEST_ADMIN_PASSWORD ?? "Teste@123456";

export function isTestAdminEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  return TEST_ADMIN_EMAIL_ALIASES.includes(normalized as (typeof TEST_ADMIN_EMAIL_ALIASES)[number]);
}

export function normalizeTestAdminEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  return isTestAdminEmail(normalized) ? TEST_ADMIN_CANONICAL_EMAIL : normalized;
}
