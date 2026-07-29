import { PrismaClient } from "@prisma/client";
import { prisma as sharedPrisma } from "@/lib/prisma";
import { buildCompanyIdentity } from "@/services/company/identity";

const prisma = sharedPrisma ?? new PrismaClient();

function pushGroup(map: Map<string, Array<Record<string, unknown>>>, key: string, row: Record<string, unknown>) {
  const items = map.get(key) ?? [];
  items.push(row);
  map.set(key, items);
}

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      codigoInterno: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      codigoInternoNormalizado: true,
      razaoSocialNormalizada: true,
      regimeNormalizado: true,
      identityKind: true,
      cnpjNumerico: true,
      regimeTributario: true,
      ativo: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const groups = new Map<string, Array<Record<string, unknown>>>();
  const missingIdentity: Array<Record<string, unknown>> = [];
  const inconsistencies: Array<Record<string, unknown>> = [];

  for (const company of companies) {
    const identity = buildCompanyIdentity({
      codigoInterno: company.codigoInterno,
      razaoSocial: company.razaoSocial,
      nomeFantasia: company.nomeFantasia,
      cnpj: company.cnpj,
      regimeTributario: company.regimeTributario,
    });

    const key = identity?.key ?? null;
    if (!key) {
      missingIdentity.push(company as Record<string, unknown>);
      continue;
    }

    pushGroup(groups, key, company as Record<string, unknown>);

    if (company.identityKind !== identity.kind) {
      inconsistencies.push({
        id: company.id,
        issue: "identity_kind_mismatch",
        expected: identity.kind,
        actual: company.identityKind,
      });
    }
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      key,
      count: rows.length,
      rows: rows.slice(0, 10).map((row) => ({
        id: row.id,
        razaoSocial: row.razaoSocial,
        nomeFantasia: row.nomeFantasia,
        cnpjNumerico: row.cnpjNumerico,
        regimeTributario: row.regimeTributario,
        ativo: row.ativo,
      })),
    }));

  const report = {
    totalCompanies: companies.length,
    duplicateGroupsCount: duplicateGroups.length,
    missingIdentityCount: missingIdentity.length,
    invalidStatusCount: 0,
    inconsistenciesCount: inconsistencies.length,
    duplicateGroups,
    missingIdentity: missingIdentity.slice(0, 50).map((row) => ({
      id: row.id,
      razaoSocial: row.razaoSocial,
      nomeFantasia: row.nomeFantasia,
      cnpjNumerico: row.cnpjNumerico,
      regimeTributario: row.regimeTributario,
      ativo: row.ativo,
    })),
    inconsistencies: inconsistencies.slice(0, 50),
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if ("$disconnect" in prisma && typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  });

