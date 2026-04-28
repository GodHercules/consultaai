export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { searchCompanies } from "@/repositories/companyRepository";
import { auditLog } from "@/services/audit";
import { requireAuth } from "@/services/auth/require";
import { normalizeCompany } from "@/services/company/normalize";

const createSchema = z.object({
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

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

  const result = await searchCompanies({
    q: url.searchParams.get("q"),
    cnpj: url.searchParams.get("cnpj"),
    grupo: url.searchParams.get("grupo"),
    regimeTributario: url.searchParams.get("regimeTributario"),
    codigoInterno: url.searchParams.get("codigoInterno"),
    sistema: url.searchParams.get("sistema"),
    certificado: url.searchParams.get("certificado"),
    ativo:
      url.searchParams.get("ativo") === null
        ? null
        : url.searchParams.get("ativo") === "true"
          ? true
          : url.searchParams.get("ativo") === "false"
            ? false
            : null,
    page,
    pageSize,
  });

  return Response.json(result);
}

export async function POST(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const data = normalizeCompany(parsed.data);

  const company = await prisma.company.create({
    data,
  });

  await auditLog({
    userId: auth.session.user.id,
    action: "COMPANY_CREATED",
    entity: "Company",
    entityId: company.id,
    newValue: company,
  });

  return Response.json({ company }, { status: 201 });
}

