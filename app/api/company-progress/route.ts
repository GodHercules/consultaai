export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/services/auth/require";
import type { ProgressStatus } from "@prisma/client";

const createSchema = z.object({
  companyId: z.string().min(1),
  title: z.string().min(2).max(120),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await requireAuth({ department: "CONTABIL" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId");
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? "50"), 1), 200);

  const where: NonNullable<Parameters<typeof prisma.companyProgress.findMany>[0]>["where"] = {
    ...(companyId ? { companyId } : {}),
    ...(auth.session.user.role === "ADMIN" ? {} : { createdByUserId: auth.session.user.id }),
  };

  const items = await prisma.companyProgress.findMany({
    where,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      notes: true,
      createdAt: true,
      company: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjNumerico: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
    },
  });

  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ department: "CONTABIL" });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return Response.json({ error: "INVALID_DATES" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true },
  });
  if (!company) return Response.json({ error: "COMPANY_NOT_FOUND" }, { status: 404 });

  const item = await prisma.companyProgress.create({
    data: {
      companyId: company.id,
      title: parsed.data.title.trim(),
      status: (parsed.data.status ?? "TODO") as ProgressStatus,
      startDate: start,
      endDate: end,
      notes: parsed.data.notes?.trim() || null,
      createdByUserId: auth.session.user.id,
    },
    select: { id: true },
  });

  return Response.json({ id: item.id }, { status: 201 });
}
