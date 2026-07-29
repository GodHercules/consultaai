import { PrismaClient } from "@prisma/client";
import { prisma as sharedPrisma } from "@/lib/prisma";
import { normalizeCompany } from "@/services/company/normalize";

const prisma = sharedPrisma ?? new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      codigoInterno: true,
      razaoSocial: true,
      nomeFantasia: true,
      cnpj: true,
      grupo: true,
      regimeTributario: true,
      sistema: true,
      certificado: true,
      ativo: true,
      codigoInternoNormalizado: true,
      razaoSocialNormalizada: true,
      regimeNormalizado: true,
      identityKind: true,
      cnpjNumerico: true,
      raizCnpj: true,
      grupoNormalizado: true,
    },
  });

  let updated = 0;
  let unchanged = 0;

  for (const company of companies) {
    const normalized = normalizeCompany({
      codigoInterno: company.codigoInterno,
      razaoSocial: company.razaoSocial,
      nomeFantasia: company.nomeFantasia,
      cnpj: company.cnpj,
      grupo: company.grupo,
      regimeTributario: company.regimeTributario,
      sistema: company.sistema,
      certificado: company.certificado,
      ativo: company.ativo,
    });

    const patch: Record<string, unknown> = {};
    for (const key of [
      "codigoInternoNormalizado",
      "razaoSocialNormalizada",
      "regimeNormalizado",
      "identityKind",
      "cnpjNumerico",
      "raizCnpj",
      "grupoNormalizado",
    ] as const) {
      if (company[key] !== normalized[key]) {
        patch[key] = normalized[key];
      }
    }

    if (!Object.keys(patch).length) {
      unchanged += 1;
      continue;
    }

    updated += 1;
    if (dryRun) continue;

    await prisma.company.update({
      where: { id: company.id },
      data: patch,
    });
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        total: companies.length,
        updated,
        unchanged,
      },
      null,
      2,
    ),
  );
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

