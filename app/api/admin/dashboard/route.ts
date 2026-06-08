export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/services/auth/require";

export async function GET() {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const [
    companiesActive,
    companiesInactive,
    usersActive,
    lastImports,
  ] = await Promise.all([
    prisma.company.count({ where: { ativo: true } }),
    prisma.company.count({ where: { ativo: false } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.importHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, fileName: true, total: true, created: true, updated: true, ignored: true, suspectedDuplicates: true, status: true, createdAt: true },
    }),
  ]);

  return Response.json({
    companiesActive,
    companiesInactive,
    usersActive,
    lastImports,
  });
}
