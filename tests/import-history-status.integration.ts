import assert from "node:assert/strict";
import { cleanupImportArtifacts, createWorkbook, getTestCookie, getTestPrisma, makeValidCnpj } from "./import-test-helpers";

async function main() {
  const prisma = await getTestPrisma();
  const cookie = await getTestCookie(prisma);
  const prefix = `STATUS_${Date.now()}`;
  const cnpj = makeValidCnpj(String(Date.now()).slice(-12).padStart(12, "0"));
  const buffer = createWorkbook(prefix, cnpj);
  const fileName = `${prefix}.xlsx`;

  try {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(buffer)], fileName));
    const importRes = await fetch("http://localhost:3000/api/admin/import", {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    const importBody = await importRes.text();
    assert.equal(importRes.status, 200, importBody);
    const importPayload = JSON.parse(importBody);
    assert.equal(importPayload.reused, false);

    const historyRes = await fetch("http://localhost:3000/api/admin/import-history", {
      headers: { cookie },
    });
    const historyBody = await historyRes.text();
    assert.equal(historyRes.status, 200, historyBody);
    const historyPayload = JSON.parse(historyBody);
    assert.ok(Array.isArray(historyPayload.items));
    assert.equal(historyPayload.items[0]?.status, "DONE");

    const dashboardRes = await fetch("http://localhost:3000/api/admin/dashboard", {
      headers: { cookie },
    });
    const dashboardBody = await dashboardRes.text();
    assert.equal(dashboardRes.status, 200, dashboardBody);
    const dashboardPayload = JSON.parse(dashboardBody);
    assert.equal(dashboardPayload.lastImports[0]?.status, "DONE");

    const pageRes = await fetch("http://localhost:3000/import/history", {
      headers: { cookie },
    });
    const html = await pageRes.text();
    assert.equal(pageRes.status, 200, html);
    assert.match(html, /Conclu/i);
  } finally {
    await cleanupImportArtifacts(prisma, prefix);
    if (typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
