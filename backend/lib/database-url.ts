export function normalizePostgresConnectionString(value: string) {
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) return value;

  const url = new URL(value);
  if (url.searchParams.has("sslmode") && !url.searchParams.has("uselibpqcompat")) {
    // DigitalOcean's managed PostgreSQL certificate is self-signed. This keeps
    // SSL enabled while using libpq's documented `require` semantics instead
    // of treating it as hostname-verified `verify-full`.
    url.searchParams.set("uselibpqcompat", "true");
  }
  return url.toString();
}
