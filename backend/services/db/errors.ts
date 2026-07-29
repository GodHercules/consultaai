export function extractPrismaErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }

  return null;
}

export function extractUniqueConstraintTarget(error: unknown) {
  if (typeof error !== "object" || error === null || !("meta" in error)) return [];

  const meta = (error as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object" || !("target" in meta)) return [];

  const target = (meta as { target?: unknown }).target;
  if (Array.isArray(target)) {
    return target.filter((value): value is string => typeof value === "string");
  }

  if (typeof target === "string" && target.trim()) {
    return [target];
  }

  return [];
}

export function isUniqueConstraintError(error: unknown) {
  const code = extractPrismaErrorCode(error);
  if (code === "P2002") return true;

  const message = error instanceof Error ? error.message : String(error);
  return /Unique constraint failed|duplicate key value violates unique constraint|P2002/i.test(message);
}
