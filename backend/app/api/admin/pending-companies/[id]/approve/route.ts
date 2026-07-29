export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { isUniqueConstraintError } from "@/services/db/errors";
import { requireAuth } from "@/services/auth/require";
import { normalizeCompany } from "@/services/company/normalize";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  const pending = await prisma.pendingCompany.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      deliveryId: true,
      payload: true,
      codigoInterno: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      grupo: true,
      regimeTributario: true,
      sistema: true,
      certificado: true,
    },
  });
  if (!pending) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (pending.status !== "PENDING") {
    return Response.json({ error: "ALREADY_DECIDED" }, { status: 400 });
  }

  const normalized = normalizeCompany({
    codigoInterno: pending.codigoInterno,
    razaoSocial: pending.razaoSocial,
    nomeFantasia: pending.nomeFantasia,
    cnpj: pending.cnpj,
    grupo: pending.grupo,
    regimeTributario: pending.regimeTributario,
    sistema: pending.sistema,
    certificado: pending.certificado,
    ativo: true,
  });

  const hasIdentity = Boolean(
    normalized.cnpjNumerico || normalized.razaoSocialNormalizada || normalized.codigoInternoNormalizado,
  );

  if (!hasIdentity) {
    return Response.json({ error: "IDENTITY_REQUIRED" }, { status: 400 });
  }

  const companyWhere = normalized.cnpjNumerico
    ? { cnpjNumerico: normalized.cnpjNumerico }
    : normalized.razaoSocialNormalizada && normalized.regimeNormalizado
      ? {
          razaoSocialNormalizada: normalized.razaoSocialNormalizada,
          regimeNormalizado: normalized.regimeNormalizado,
        }
      : normalized.codigoInternoNormalizado
        ? { codigoInternoNormalizado: normalized.codigoInternoNormalizado }
        : null;

  let company = companyWhere ? await prisma.company.findFirst({ where: companyWhere }) : null;

  if (!company) {
    try {
      company = await prisma.company.create({ data: normalized });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      company = companyWhere ? await prisma.company.findFirst({ where: companyWhere }) : null;
      if (!company) {
        throw error;
      }
    }
  }

  await prisma.pendingCompany.update({
    where: { id: pending.id },
    data: {
      status: "APPROVED",
      decidedAt: new Date(),
      decidedByUserId: auth.session.user.id,
      companyId: company.id,
    },
  });

  if (pending.deliveryId) {
    await prisma.webhookDelivery.update({
      where: { id: pending.deliveryId },
      data: { processedAt: new Date() },
    }).catch(() => null);
  }

  await auditLog({
    userId: auth.session.user.id,
    action: "PENDING_COMPANY_APPROVED",
    entity: "PendingCompany",
    entityId: pending.id,
    newValue: { companyId: company.id },
  });

  await auditLog({
    userId: auth.session.user.id,
    action: "COMPANY_CREATED_VIA_WEBHOOK",
    entity: "Company",
    entityId: company.id,
    newValue: { pendingCompanyId: pending.id },
  });

  return Response.json({ companyId: company.id });
}

