export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/services/auth/require";
import type { PendingCompanyStatus } from "@prisma/client";

export async function GET(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const statusParam = (url.searchParams.get("status") ?? "PENDING").toUpperCase();
  const allowedStatuses: PendingCompanyStatus[] = ["PENDING", "APPROVED", "REJECTED"];
  const status: PendingCompanyStatus | "ALL" =
    statusParam === "ALL"
      ? "ALL"
      : (allowedStatuses.includes(statusParam as PendingCompanyStatus)
          ? (statusParam as PendingCompanyStatus)
          : "PENDING");
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? "50"), 1), 100);

  const items = await prisma.pendingCompany.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { receivedAt: "desc" },
    take,
    select: {
      id: true,
      source: true,
      status: true,
      receivedAt: true,
      codigoInterno: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      cnpjNumerico: true,
      grupo: true,
      regimeTributario: true,
      sistema: true,
      certificado: true,
    },
  });

  return Response.json({ items });
}
