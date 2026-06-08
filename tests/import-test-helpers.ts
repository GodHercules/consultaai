import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

export async function getTestPrisma() {
  const prismaMod = await import("../lib/prisma") as unknown as { prisma: PrismaClient };
  return prismaMod.prisma;
}

export async function clearTestRateLimitBuckets(prisma: PrismaClient) {
  await prisma.rateLimitBucket.deleteMany({
    where: {
      OR: [
        { bucketKey: { contains: "test.admin@local.com" } },
        { bucketKey: { contains: "teste.admin@local.com" } },
      ],
    },
  });
}

export async function getTestCookie(prisma: PrismaClient) {
  if (process.env.TEST_AUTH_COOKIE) {
    return process.env.TEST_AUTH_COOKIE;
  }

  await clearTestRateLimitBuckets(prisma);

  const loginRes = await fetch("http://localhost:3000/api/auth/login?redirect=0", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "teste.admin@local.com",
      password: "Teste@123456",
    }),
  });

  assert.equal(loginRes.status, 200);
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  return cookie;
}

export async function cleanupImportArtifacts(prisma: PrismaClient, prefix: string) {
  const histories = await prisma.importHistory.findMany({
    where: { fileName: { contains: prefix, mode: "insensitive" } },
    select: { id: true },
  });
  const historyIds = histories.map((item: { id: string }) => item.id);

  if (historyIds.length) {
    await prisma.auditLog.deleteMany({
      where: { entity: "ImportHistory", entityId: { in: historyIds } },
    });
  }

  await prisma.importHistory.deleteMany({
    where: { id: { in: historyIds } },
  });

  await prisma.company.deleteMany({
    where: {
      OR: [
        {
          razaoSocial: {
            contains: prefix,
            mode: "insensitive",
          },
        },
        {
          nomeFantasia: {
            contains: prefix,
            mode: "insensitive",
          },
        },
      ],
    },
  });
}

function calcVerifier(base: number[], weights: number[]) {
  const sum = base.reduce((acc, n, idx) => acc + n * weights[idx], 0);
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function makeValidCnpj(base12: string) {
  const digits = base12.replace(/\D+/g, "");
  if (digits.length !== 12) {
    throw new Error("Base de CNPJ deve ter 12 digitos.");
  }

  const nums = digits.split("").map((digit) => Number(digit));
  const d1 = calcVerifier(nums, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcVerifier([...nums, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return `${digits}${d1}${d2}`;
}

export function createWorkbook(prefix: string, cnpj: string) {
  const workbook = XLSX.utils.book_new();
  const rows = [
    [
      "Codigo Interno",
      "Razao Social",
      "Nome Fantasia",
      "CNPJ",
      "Grupo",
      "Regime Tributario",
      "Sistema",
      "Certificado",
      "Status",
    ],
    [null, `${prefix} Empresa LTDA`, prefix, cnpj, null, null, null, null, "ATIVO"],
  ];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Simples Nacional");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function createSimpleWorkbookFromRows(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Simples Nacional");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
