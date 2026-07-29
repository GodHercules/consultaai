export function getClientIp(headers: { get(name: string): string | null }) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip") ?? null;
}
