import assert from "node:assert/strict";
import fs from "node:fs";
import { Prisma } from "@prisma/client";
import { importCompaniesFromExcel, previewImportCompaniesFromExcel } from "@/services/import/importExcel";
import { getTestPrisma } from "./import-test-helpers";

const rollbackSignal = new Error("ROLLBACK_MF_WORKBOOK_TEST");

function loadWorkbookBuffer() {
  return fs.readFileSync("C:/Users/PC/Downloads/EMPRESAS DA MF (1).xlsx");
}

async function withRollback<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  const prisma = await getTestPrisma();
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw rollbackSignal;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error !== rollbackSignal) {
      throw error;
    }
  } finally {
    if (typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  }
}

async function main() {
  const buffer = loadWorkbookBuffer();
  const preview = await previewImportCompaniesFromExcel({
    actorUserId: "preview-test",
    fileName: "EMPRESAS DA MF (1).xlsx",
    buffer,
  });

  assert.equal(preview.fileName, "EMPRESAS DA MF (1).xlsx");
  assert.equal(preview.sheets.length, 1);
  assert.ok(preview.rowsRead >= 200);
  assert.ok(preview.duplicateGroups.length >= 0);

  await withRollback(async (tx) => {
    const actor = await tx.user.findFirst({ select: { id: true } });
    assert.ok(actor);

    const result = await importCompaniesFromExcel({
      actorUserId: actor.id,
      fileName: "EMPRESAS DA MF (1).xlsx",
      buffer,
      db: tx,
    });

    assert.ok(result.created >= 200);

    const company = await tx.company.findFirst({
      where: { cnpjNumerico: "17890469000146" },
    });

    assert.ok(company);
    assert.equal(company?.qtd, 1);
    assert.equal(company?.codigoInterno, "3");
    assert.match(company?.razaoSocial ?? "", /ALTO BELA VISTA EMPREENDIMENTOS IMOBILI/);
    assert.equal(company?.ehGrupo, true);
    assert.equal(company?.grupo, "Grupo Terral");
    assert.equal(company?.regimeTributario, "Lucro Presumido");
    assert.equal(company?.certificado, "CAIXA");
    assert.equal(company?.ativo, true);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
