import assert from "node:assert/strict";
import { createWorkbook, cleanupImportArtifacts, getTestPrisma, makeValidCnpj } from "./import-test-helpers";
import { importCompaniesFromExcel } from "@/services/import/importExcel";
import { sha256Base64UrlBytes } from "@/utils/crypto";

async function main() {
  const prisma = await getTestPrisma();
  const actor = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(actor);

  const prefix = `IDEMP_${Date.now()}`;
  const cnpj = makeValidCnpj(String(Date.now()).slice(-12).padStart(12, "0"));
  const buffer = createWorkbook(prefix, cnpj);
  const fileHash = await sha256Base64UrlBytes(buffer);
  const fileName = `${prefix}.xlsx`;

  try {
    const first = await importCompaniesFromExcel({
      actorUserId: actor.id,
      fileName,
      buffer,
      fileHash,
      db: prisma,
    });

    assert.equal(first.created, 1);
    assert.equal(first.updated, 0);
    assert.equal(first.ignored, 0);

    const second = await importCompaniesFromExcel({
      actorUserId: actor.id,
      fileName: `${prefix}_segunda.xlsx`,
      buffer,
      fileHash,
      db: prisma,
    });

    assert.equal(second.id, first.id);
    assert.equal(second.fileHash, fileHash);
    assert.equal(
      await prisma.company.count({
        where: {
          razaoSocial: {
            contains: prefix,
            mode: "insensitive",
          },
        },
      }),
      1,
    );
    assert.equal(
      await prisma.importHistory.count({
        where: { fileHash },
      }),
      1,
    );
  } finally {
    await cleanupImportArtifacts(prisma, prefix);
    await prisma.importHistory.deleteMany({
      where: { fileHash },
    });
    if (typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
