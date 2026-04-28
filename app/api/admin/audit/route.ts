export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/services/auth/require";

export async function GET(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20")));
  const skip = (page - 1) * pageSize;

  const where: Parameters<typeof prisma.auditLog.findMany>[0]["where"] = {
    ...(url.searchParams.get("entity") ? { entity: url.searchParams.get("entity")! } : {}),
    ...(url.searchParams.get("action") ? { action: url.searchParams.get("action")! } : {}),
    ...(url.searchParams.get("userId") ? { userId: url.searchParams.get("userId")! } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        oldValue: true,
        newValue: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return Response.json({ total, page, pageSize, items });
}

