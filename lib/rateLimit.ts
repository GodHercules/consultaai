type Entry = { ts: number }[];

const buckets = new Map<string, Entry>();

export function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const cutoff = now - options.windowMs;
  const entry = buckets.get(options.key) ?? [];

  const pruned = entry.filter((e) => e.ts > cutoff);
  pruned.push({ ts: now });
  buckets.set(options.key, pruned);

  const remaining = Math.max(0, options.limit - pruned.length);
  return {
    ok: pruned.length <= options.limit,
    remaining,
    resetAt: new Date(cutoff + options.windowMs).toISOString(),
  };
}

