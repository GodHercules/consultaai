export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/services/auth/require";

export async function GET(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? "50"), 1), 100);
  const q = url.searchParams.get("q")?.trim() || null;
  const where: NonNullable<Parameters<typeof prisma.integrationEvent.findMany>[0]>["where"] = {
    ...(status ? { status: status as never } : {}),
    source: "FundarMF",
    ...(q ? { OR: [
      { eventType: { contains: q, mode: "insensitive" } },
      { deliveryId: { contains: q, mode: "insensitive" } },
      { fundarmfCaseId: { contains: q, mode: "insensitive" } },
      { companyCnpj: { contains: q, mode: "insensitive" } },
      { errorMessage: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };

  const [total, items, received, processing, processed, reviewRequired, failed, duplicate] = await Promise.all([
    prisma.integrationEvent.count({ where }),
    prisma.integrationEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, source: true, eventType: true, deliveryId: true, fundarmfCaseId: true,
        companyCnpj: true, status: true, errorMessage: true, createdAt: true, processedAt: true,
      },
    }),
    prisma.integrationEvent.count({ where: { source: "FundarMF", status: "RECEIVED" } }),
    prisma.integrationEvent.count({ where: { source: "FundarMF", status: "PROCESSING" } }),
    prisma.integrationEvent.count({ where: { source: "FundarMF", status: "PROCESSED" } }),
    prisma.integrationEvent.count({ where: { source: "FundarMF", status: "REVIEW_REQUIRED" } }),
    prisma.integrationEvent.count({ where: { source: "FundarMF", status: "FAILED" } }),
    prisma.integrationEvent.count({ where: { source: "FundarMF", status: "DUPLICATE" } }),
  ]);

  return Response.json({ total, page, pageSize, items, summary: { received, processing, processed, reviewRequired, failed, duplicate } });
}
