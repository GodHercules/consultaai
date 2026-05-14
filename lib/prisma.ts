import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function prismaClientOptions() {
  const url = process.env.DATABASE_URL;
  const accelerateUrl = process.env.PRISMA_ACCELERATE_URL ?? undefined;
  const isPostgresDirect = Boolean(url && (url.startsWith("postgresql://") || url.startsWith("postgres://")));
  const isPrismaPostgres = Boolean(url && url.startsWith("prisma+postgres://"));
  const isPrismaAccelerate = Boolean(url && url.startsWith("prisma://"));

  if (!url) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient.");
  }

  const connection =
    accelerateUrl
      ? { accelerateUrl }
      : isPrismaPostgres || isPrismaAccelerate
        ? { accelerateUrl: url }
        : isPostgresDirect
          ? { adapter: new PrismaPg({ connectionString: url }) }
          : {};

  return {
    ...(connection as Record<string, unknown>),
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
