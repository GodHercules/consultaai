export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { isUniqueConstraintError } from "@/services/db/errors";
import { requireAuth } from "@/services/auth/require";
import { normalizeCompany } from "@/services/company/normalize";
import { parseContractDate } from "@/utils/contracts";

const nullableInteger = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}, z.number().int().optional().nullable());

const nullableDate = z.preprocess((value) => parseContractDate(value as Date | string | null | undefined), z.date().optional().nullable());

const updateSchema = z.object({
  qtd: nullableInteger,
  codigoInterno: z.string().optional().nullable(),
  razaoSocial: z.string().optional().nullable(),
  nomeFantasia: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  ehGrupo: z.boolean().optional().nullable(),
  grupo: z.string().optional().nullable(),
  regimeTributario: z.string().optional().nullable(),
  sistema: z.string().optional().nullable(),
  certificado: z.string().optional().nullable(),
  anexo: z.string().optional().nullable(),
  das: z.string().optional().nullable(),
  municipio: z.string().optional().nullable(),
  telefoneContato: z.string().optional().nullable(),
  emailContato: z.string().optional().nullable(),
  contractStartedAt: nullableDate,
  contractEndedAt: nullableDate,
  contractPredictedEndedAt: nullableDate,
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
  const hasIdentity = Boolean(
    data.cnpjNumerico || data.razaoSocialNormalizada || data.codigoInternoNormalizado,
  );

  if (!hasIdentity) {
    return Response.json({ error: "IDENTITY_REQUIRED" }, { status: 400 });
  }

  let company;
  try {
    company = await prisma.company.update({ where: { id }, data });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "DUPLICATE_COMPANY" }, { status: 409 });
    }
    throw error;
  }

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
