export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
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

  const company = await prisma.company.upsert({
    where: normalized.cnpjNumerico ? { cnpjNumerico: normalized.cnpjNumerico } : { id: "__never__" },
    create: normalized,
    update: normalized,
  }).catch(async () => {
    // Se não houver CNPJ válido (cnpjNumerico null), cria sempre.
    return prisma.company.create({ data: normalized });
  });

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

