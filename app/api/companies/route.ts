export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { searchCompanies } from "@/repositories/companyRepository";
import { auditLog } from "@/services/audit";
import { isUniqueConstraintError } from "@/services/db/errors";
import { requireAuth } from "@/services/auth/require";
import { normalizeCompany } from "@/services/company/normalize";

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

const createSchema = z.object({
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
  const hasIdentity = Boolean(
    data.cnpjNumerico || data.razaoSocialNormalizada || data.codigoInternoNormalizado,
  );

  if (!hasIdentity) {
    return Response.json({ error: "IDENTITY_REQUIRED" }, { status: 400 });
  }

  let company;
  try {
    company = await prisma.company.create({
      data,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json({ error: "DUPLICATE_COMPANY" }, { status: 409 });
    }
    throw error;
  }

  await auditLog({
    userId: auth.session.user.id,
    action: "COMPANY_CREATED",
    entity: "Company",
    entityId: company.id,
    newValue: company,
  });

  return Response.json({ company }, { status: 201 });
}
