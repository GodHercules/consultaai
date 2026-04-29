import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function prismaClientOptions() {
  const url = process.env.DATABASE_URL;
  const isPrismaPostgres = Boolean(url && url.startsWith("prisma+postgres://"));

  return {
    ...(isPrismaPostgres ? { accelerateUrl: url } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  } satisfies ConstructorParameters<typeof PrismaClient>[0];
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...prismaClientOptions(),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
