export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/services/auth/require";

export async function GET(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? "50"), 1), 100);
  const where: NonNullable<Parameters<typeof prisma.integrationEvent.findMany>[0]>["where"] = {
    ...(status ? { status: status as never } : {}),
    source: "FundarMF",
  };

  const items = await prisma.integrationEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      source: true,
      eventType: true,
      deliveryId: true,
      fundarmfCaseId: true,
      companyCnpj: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      processedAt: true,
    },
  });

  return Response.json({ items });
}
