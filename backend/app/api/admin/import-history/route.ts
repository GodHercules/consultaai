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

  const [total, items] = await Promise.all([
    prisma.importHistory.count(),
    prisma.importHistory.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        fileName: true,
        total: true,
        created: true,
        updated: true,
        ignored: true,
        suspectedDuplicates: true,
        errors: true,
        report: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return Response.json({ total, page, pageSize, items });
}
