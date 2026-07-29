import { prisma } from "@/lib/prisma";

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + options.windowMs);

  let count: number;
  let bucketResetAt: Date;

  try {
    const bucket = await prisma.rateLimitBucket.findUnique({
      where: { bucketKey: options.key },
    });

    if (!bucket || bucket.resetAt <= now) {
      const next = await prisma.rateLimitBucket.upsert({
        where: { bucketKey: options.key },
        create: { bucketKey: options.key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      count = next.count;
      bucketResetAt = next.resetAt;
    } else {
      const next = await prisma.rateLimitBucket.update({
        where: { bucketKey: options.key },
        data: { count: { increment: 1 } },
      });
      count = next.count;
      bucketResetAt = next.resetAt;
    }
  } catch (error) {
    console.warn("Rate limit storage unavailable, falling back to memory", error);

    const memoryBucket = memoryBuckets.get(options.key);
    if (!memoryBucket || memoryBucket.resetAt <= now.getTime()) {
      memoryBuckets.set(options.key, { count: 1, resetAt: resetAt.getTime() });
      count = 1;
      bucketResetAt = resetAt;
    } else {
      memoryBucket.count += 1;
      memoryBuckets.set(options.key, memoryBucket);
      count = memoryBucket.count;
      bucketResetAt = new Date(memoryBucket.resetAt);
    }
  }

  return {
    ok: count <= options.limit,
    remaining: Math.max(0, options.limit - count),
    resetAt: bucketResetAt.toISOString(),
  };
}
