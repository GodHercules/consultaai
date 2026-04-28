import { prisma } from "@/lib/prisma";
import { normalizeText, onlyDigits } from "@/utils/strings";

export type CompanySearchParams = {
  q?: string | null;
  cnpj?: string | null;
  grupo?: string | null;
  regimeTributario?: string | null;
  codigoInterno?: string | null;
  sistema?: string | null;
  certificado?: string | null;
  ativo?: boolean | null;
  page: number;
  pageSize: number;
};

export async function searchCompanies(params: CompanySearchParams) {
  const pageSize = Math.min(Math.max(params.pageSize, 1), 50);
  const page = Math.max(params.page, 1);
  const skip = (page - 1) * pageSize;

  const q = params.q?.trim() || null;
  const grupoNorm = params.grupo ? normalizeText(params.grupo) : null;
  const cnpjDigits = params.cnpj ? onlyDigits(params.cnpj) : null;

  const where: Parameters<typeof prisma.company.findMany>[0]["where"] = {
    ...(params.ativo === null || params.ativo === undefined ? {} : { ativo: params.ativo }),
    ...(params.codigoInterno ? { codigoInterno: { contains: params.codigoInterno.trim(), mode: "insensitive" } } : {}),
    ...(params.sistema ? { sistema: { contains: params.sistema.trim(), mode: "insensitive" } } : {}),
    ...(params.certificado ? { certificado: { contains: params.certificado.trim(), mode: "insensitive" } } : {}),
    ...(params.regimeTributario ? { regimeTributario: { contains: params.regimeTributario.trim(), mode: "insensitive" } } : {}),
    ...(grupoNorm ? { grupoNormalizado: { contains: grupoNorm } } : {}),
  };

  const or: NonNullable<typeof where>["OR"] = [];
  if (q) {
    const qNorm = normalizeText(q);
    or.push(
      { razaoSocial: { contains: q, mode: "insensitive" } },
      { nomeFantasia: { contains: q, mode: "insensitive" } },
      { codigoInterno: { contains: q, mode: "insensitive" } },
      { sistema: { contains: q, mode: "insensitive" } },
      { certificado: { contains: q, mode: "insensitive" } },
      { grupoNormalizado: { contains: qNorm } },
    );
  }
  if (cnpjDigits) {
    if (cnpjDigits.length >= 14) {
      or.push({ cnpjNumerico: cnpjDigits.slice(0, 14) });
    } else if (cnpjDigits.length >= 5) {
      or.push({ cnpjNumerico: { startsWith: cnpjDigits } });
    }
  }
  if (or.length) where.OR = or;

  const [total, items] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: [{ ativo: "desc" }, { razaoSocial: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        codigoInterno: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpj: true,
        cnpjNumerico: true,
        grupo: true,
        regimeTributario: true,
        sistema: true,
        certificado: true,
        ativo: true,
        updatedAt: true,
      },
    }),
  ]);

  return { total, page, pageSize, items };
}

