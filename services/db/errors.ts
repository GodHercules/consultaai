export function isUniqueConstraintError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: string }).code === "P2002";
  }

  const message = error instanceof Error ? error.message : String(error);
  return /Unique constraint failed|duplicate key value violates unique constraint|P2002/i.test(message);
}

