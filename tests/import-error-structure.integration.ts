import assert from "node:assert/strict";
import { classifyImportFailure } from "@/services/import/errors";
import { getTestCookie, getTestPrisma } from "./import-test-helpers";

async function main() {
  const dbError = classifyImportFailure(new Error("Authentication failed for user"));
  assert.equal(dbError.code, "DATABASE_UNAVAILABLE");
  assert.equal(dbError.status, 503);

  const genericError = classifyImportFailure(new Error("Unexpected import crash"));
  assert.equal(genericError.code, "IMPORT_FAILED");
  assert.equal(genericError.status, 500);

  const prisma = await getTestPrisma();
  try {
    const cookie = await getTestCookie(prisma);

    const previewRes = await fetch("http://localhost:3000/api/admin/import", {
      method: "POST",
      headers: { cookie },
      body: new FormData(),
    });

    assert.equal(previewRes.status, 400);
    const payload = await previewRes.json();
    assert.ok(payload.error);
    assert.equal(payload.error.code, "FILE_REQUIRED");
    assert.equal(typeof payload.error.correlationId, "string");
    assert.ok(payload.error.correlationId.length > 0);
    assert.equal(typeof payload.error.message, "string");
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
