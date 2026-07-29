import assert from "node:assert/strict";
import fs from "node:fs";
import { getTestCookie, getTestPrisma } from "./import-test-helpers";

async function main() {
  const prisma = await getTestPrisma();
  try {
    const cookie = await getTestCookie(prisma);

    const baseline = {
      companies: await prisma.company.count(),
      importHistory: await prisma.importHistory.count(),
      auditLog: await prisma.auditLog.count(),
      pendingCompany: await prisma.pendingCompany.count(),
      companyProgress: await prisma.companyProgress.count(),
    };

    const filePath = "C:/Users/PC/Downloads/04_ABRIL_2026_tratada_status.xlsx";
    const form = new FormData();
    form.set("file", new File([fs.readFileSync(filePath)], "04_ABRIL_2026_tratada_status.xlsx"));

    const previewRes = await fetch("http://localhost:3000/api/admin/import?dryRun=1", {
      method: "POST",
      headers: { cookie },
      body: form,
    });

    assert.equal(previewRes.status, 200);
    const payload = await previewRes.json();
    assert.ok(payload.preview);
    assert.equal(payload.preview.fileName, "04_ABRIL_2026_tratada_status.xlsx");
    assert.ok(payload.preview.rowsRead > 0);
    assert.ok(payload.preview.suspectedDuplicates >= 0);

    const after = {
      companies: await prisma.company.count(),
      importHistory: await prisma.importHistory.count(),
      auditLog: await prisma.auditLog.count(),
      pendingCompany: await prisma.pendingCompany.count(),
      companyProgress: await prisma.companyProgress.count(),
    };

    assert.deepEqual(after, baseline);
  } finally {
    if (typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
