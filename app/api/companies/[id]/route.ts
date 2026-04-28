export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { requireAuth } from "@/services/auth/require";
import { normalizeCompany } from "@/services/company/normalize";

const updateSchema = z.object({
  codigoInterno: z.string().optional().nullable(),
  razaoSocial: z.string().optional().nullable(),
  nomeFantasia: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  grupo: z.string().optional().nullable(),
  regimeTributario: z.string().optional().nullable(),
  sistema: z.string().optional().nullable(),
  certificado: z.string().optional().nullable(),
  ativo: z.boolean().optional().nullable(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ company });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const old = await prisma.company.findUnique({ where: { id } });
  if (!old) return Response.json({ error: "NOT_FOUND" }, { status: 404 });

  const data = normalizeCompany(parsed.data);
  const company = await prisma.company.update({ where: { id }, data });

  await auditLog({
    userId: auth.session.user.id,
    action: "COMPANY_UPDATED",
    entity: "Company",
    entityId: id,
    oldValue: old,
    newValue: company,
  });

  return Response.json({ company });
}

