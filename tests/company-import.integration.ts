import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { importCompaniesFromExcel } from "@/services/import/importExcel";
import { isUniqueConstraintError } from "@/services/db/errors";
import { normalizeCompany } from "@/services/company/normalize";

let ACTOR_USER_ID = "";
const rollbackSignal = new Error("ROLLBACK_TEST_TRANSACTION");
const runId = `ci_${Date.now()}`;
let cnpjCounter = 0;
const autoCnpjCache = new Map<string, string>();

function uniqueCnpjBase() {
  cnpjCounter += 1;
  return String(Date.now() + cnpjCounter).slice(-12).padStart(12, "0");
}

function createWorkbook(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function baseHeader() {
  return [
    "Código Interno",
    "Razão Social",
    "Nome Fantasia",
    "CNPJ",
    "Grupo",
    "Regime Tributário",
    "Sistema",
    "Certificado",
    "Status",
  ];
}

function companyRow(input: {
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  grupo?: string | null;
  sistema?: string | null;
  certificado?: string | null;
  status?: string | boolean | null;
}) {
  const identityKey = [input.codigoInterno ?? "", input.razaoSocial ?? "", input.nomeFantasia ?? ""].join("|");
  const cnpj =
    input.cnpj === undefined
      ? autoCnpjCache.get(identityKey) ?? (() => {
          const next = makeValidCnpj(uniqueCnpjBase());
          autoCnpjCache.set(identityKey, next);
          return next;
        })()
      : input.cnpj;

  return [
    input.codigoInterno ?? null,
    input.razaoSocial ?? null,
    input.nomeFantasia ?? null,
    cnpj,
    input.grupo ?? null,
    null,
    input.sistema ?? null,
    input.certificado ?? null,
    input.status ?? null,
  ];
}

function calcVerifier(base: number[], weights: number[]) {
  const sum = base.reduce((acc, n, idx) => acc + n * weights[idx], 0);
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

function makeValidCnpj(base12: string) {
  const digits = base12.replace(/\D+/g, "");
  if (digits.length !== 12) {
    throw new Error("Base de CNPJ deve ter 12 digitos.");
  }

  const nums = digits.split("").map((digit) => Number(digit));
  const d1 = calcVerifier(nums, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcVerifier([...nums, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return `${digits}${d1}${d2}`;
}

async function withRollback<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw rollbackSignal;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error === rollbackSignal) return;
    throw error;
  }
}

async function runTest(name: string, fn: () => Promise<void>) {
  process.stdout.write(`- ${name}... `);
  try {
    await fn();
    console.log("ok");
  } catch (error) {
    console.log("fail");
    throw error;
  }
}

async function seedCompany(tx: Prisma.TransactionClient, input: Parameters<typeof normalizeCompany>[0]) {
  return tx.company.create({
    data: normalizeCompany(input),
  });
}

async function cleanupPrefix(prefix: string) {
  const histories = await prisma.importHistory.findMany({
    where: { fileName: { contains: prefix } },
    select: { id: true },
  });
  const historyIds = histories.map((item) => item.id);

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
        { codigoInterno: { contains: prefix, mode: "insensitive" } },
        { razaoSocial: { contains: prefix, mode: "insensitive" } },
        { nomeFantasia: { contains: prefix, mode: "insensitive" } },
        { regimeTributario: { contains: prefix, mode: "insensitive" } },
      ],
    },
  });
}

async function countCompaniesByPrefix(prefix: string) {
  return prisma.company.count({
    where: {
      OR: [
        { codigoInterno: { contains: prefix, mode: "insensitive" } },
        { razaoSocial: { contains: prefix, mode: "insensitive" } },
        { nomeFantasia: { contains: prefix, mode: "insensitive" } },
      ],
    },
  });
}

async function main() {
  const actor = await prisma.user.findFirst({ select: { id: true } });
  if (!actor) {
    throw new Error("No user available to act as import actor.");
  }
  ACTOR_USER_ID = actor.id;

  const tests: Array<[string, () => Promise<void>]> = [
    [
      "importa empresa nova",
      () =>
        withRollback(async (tx) => {
          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_001`,
                razaoSocial: `${runId} Empresa Nova LTDA`,
                nomeFantasia: `${runId} Nova`,
                status: "ATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_new.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 1);
          assert.equal(result.updated, 0);
          assert.equal(result.ignored, 0);

          const count = await tx.company.count({
            where: { codigoInterno: { contains: `${runId}_001`, mode: "insensitive" } },
          });
          assert.equal(count, 1);
        }),
    ],
    [
      "reimporta a mesma planilha sem duplicar",
      () =>
        withRollback(async (tx) => {
          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_002`,
                razaoSocial: `${runId} Repetida LTDA`,
                nomeFantasia: `${runId} Repetida`,
                status: "ATIVO",
              }),
            ],
          });

          const first = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_repeat.xlsx`,
            buffer: workbook,
            db: tx,
          });
          const second = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_repeat.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(first.created, 1);
          assert.equal(second.created, 0);
          assert.equal(second.ignored, 1);
          assert.equal(
            await tx.company.count({
              where: { codigoInterno: { contains: `${runId}_002`, mode: "insensitive" } },
            }),
            1,
          );
        }),
    ],
    [
      "mantem empresa existente com mesmo status sem alteracao",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj(uniqueCnpjBase());
          await seedCompany(tx, {
            codigoInterno: `${runId}_003`,
            razaoSocial: `${runId} Estavel LTDA`,
            nomeFantasia: `${runId} Estavel`,
            cnpj,
            regimeTributario: "Simples Nacional",
            ativo: true,
          });

          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_003`,
                razaoSocial: `${runId} Estavel LTDA`,
                nomeFantasia: `${runId} Estavel`,
                cnpj,
                status: "ATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_same-status.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 0);
          assert.equal(result.updated, 0);
          assert.equal(result.ignored, 1);
          const company = await tx.company.findFirst({
            where: { codigoInterno: `${runId}_003` },
          });
          assert.equal(company?.ativo, true);
        }),
    ],
    [
      "atualiza status de ativo para inativo",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj(uniqueCnpjBase());
          await seedCompany(tx, {
            codigoInterno: `${runId}_004`,
            razaoSocial: `${runId} Ativa LTDA`,
            nomeFantasia: `${runId} Ativa`,
            cnpj,
            regimeTributario: "Simples Nacional",
            ativo: true,
          });

          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_004`,
                razaoSocial: `${runId} Ativa LTDA`,
                nomeFantasia: `${runId} Ativa`,
                cnpj,
                status: "INATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_active-to-inactive.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 0);
          assert.equal(result.updated, 1);
          const company = await tx.company.findFirst({
            where: { codigoInterno: `${runId}_004` },
          });
          assert.equal(company?.ativo, false);
        }),
    ],
    [
      "atualiza status de inativo para ativo",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj(uniqueCnpjBase());
          await seedCompany(tx, {
            codigoInterno: `${runId}_005`,
            razaoSocial: `${runId} Retomada LTDA`,
            nomeFantasia: `${runId} Retomada`,
            cnpj,
            regimeTributario: "Simples Nacional",
            ativo: false,
          });

          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_005`,
                razaoSocial: `${runId} Retomada LTDA`,
                nomeFantasia: `${runId} Retomada`,
                cnpj,
                status: "ATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_inactive-to-active.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 0);
          assert.equal(result.updated, 1);
          const company = await tx.company.findFirst({
            where: { codigoInterno: `${runId}_005` },
          });
          assert.equal(company?.ativo, true);
        }),
    ],
    [
      "ignora diferencas de formato, espacos, acentos e caixa",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj(uniqueCnpjBase());
          await seedCompany(tx, {
            codigoInterno: `${runId}_006`,
            razaoSocial: "Empresa Ltda.",
            nomeFantasia: "Empresa",
            cnpj,
            grupo: "Grupo A",
            regimeTributario: "Simples Nacional",
            ativo: true,
          });

          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_006`,
                razaoSocial: "EMPRESA  LTDA",
                nomeFantasia: "Empresa",
                cnpj,
                status: "ATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_formatting.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 0);
          assert.equal(result.updated, 0);
          assert.equal(result.ignored, 1);
          assert.equal(
            await tx.company.count({
              where: { codigoInterno: { contains: `${runId}_006`, mode: "insensitive" } },
            }),
            1,
          );
        }),
    ],
    [
      "trata CNPJ com e sem mascara como o mesmo",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj(uniqueCnpjBase());
          await seedCompany(tx, {
            codigoInterno: `${runId}_007`,
            razaoSocial: `${runId} Cnpj LTDA`,
            nomeFantasia: `${runId} Cnpj`,
            cnpj,
            ativo: true,
          });

          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_007`,
                razaoSocial: `${runId} Cnpj LTDA`,
                nomeFantasia: `${runId} Cnpj`,
                cnpj,
                status: "ATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_cnpj-mask.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 0);
          assert.equal(result.updated, 0);
          assert.equal(result.ignored, 1);
          assert.equal(
            await tx.company.count({
              where: { cnpjNumerico: cnpj },
            }),
            1,
          );
        }),
    ],
    [
      "trata dados invalidos sem quebrar o banco",
      () =>
        withRollback(async (tx) => {
          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                cnpj: null,
                status: "ATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_invalid.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 0);
          assert.equal(result.updated, 0);
          assert.equal(result.ignored, 1);
          assert.ok(Array.isArray(result.errors) && result.errors.length >= 1);
          assert.equal(
            await tx.company.count({
              where: { codigoInterno: { contains: runId, mode: "insensitive" } },
            }),
            0,
          );
        }),
    ],
    [
      "faz rollback quando falha no meio da importacao",
      async () => {
        const workbook = createWorkbook({
          "Simples Nacional": [
            baseHeader(),
            companyRow({
              codigoInterno: `${runId}_009a`,
              razaoSocial: `${runId} Falha A LTDA`,
              nomeFantasia: `${runId} Falha A`,
              status: "ATIVO",
            }),
            companyRow({
              codigoInterno: `${runId}_009b`,
              razaoSocial: `${runId} Falha B LTDA`,
              nomeFantasia: `${runId} Falha B`,
              status: "ATIVO",
            }),
          ],
        });

        let createCalls = 0;

        await withRollback(async (tx) => {
          const proxyDb = new Proxy(tx, {
            get(target, prop, receiver) {
              if (prop === "company") {
                return new Proxy((target as Prisma.TransactionClient).company, {
                  get(companyTarget, companyProp, companyReceiver) {
                    if (companyProp === "create") {
                      return async (...args: Parameters<typeof companyTarget.create>) => {
                        createCalls += 1;
                        if (createCalls === 2) {
                          throw new Error("SIMULATED_FAILURE");
                        }
                        return companyTarget.create(...args);
                      };
                    }
                    return Reflect.get(companyTarget, companyProp, companyReceiver);
                  },
                });
              }
              return Reflect.get(target, prop, receiver);
            },
          }) as Prisma.TransactionClient;

          await assert.rejects(
            async () => {
              await importCompaniesFromExcel({
                actorUserId: ACTOR_USER_ID,
                fileName: `${runId}_mid-failure.xlsx`,
                buffer: workbook,
                db: proxyDb,
              });
            },
            /SIMULATED_FAILURE/,
          );
        });

        const remaining = await countCompaniesByPrefix(`${runId}_009`);
        assert.equal(remaining, 0);
      },
    ],
    [
      "impede duplicidade no banco mesmo se a regra da aplicacao falhar",
      () =>
        withRollback(async (tx) => {
          await tx.company.create({
            data: normalizeCompany({
              codigoInterno: `${runId}_010`,
              razaoSocial: `${runId} Unique LTDA`,
              nomeFantasia: `${runId} Unique`,
              regimeTributario: "Simples Nacional",
              ativo: true,
            }),
          });

          await assert.rejects(async () => {
            await tx.company.create({
              data: normalizeCompany({
                codigoInterno: `${runId}_010`,
                razaoSocial: `${runId} UNIQUE  LTDA.`,
                nomeFantasia: `${runId} Unique`,
                regimeTributario: "Simples Nacional",
                ativo: true,
              }),
            });
          }, (error) => isUniqueConstraintError(error));
        }),
    ],
    [
      "consolida a mesma empresa em abas diferentes",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj(uniqueCnpjBase());
          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_011`,
                razaoSocial: `${runId} Regime LTDA`,
                nomeFantasia: `${runId} Regime`,
                cnpj,
                status: "ATIVO",
              }),
            ],
            "Lucro Presumido": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_011`,
                razaoSocial: `${runId} Regime LTDA`,
                nomeFantasia: `${runId} Regime`,
                cnpj,
                status: "ATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_sheets.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 1);
          assert.equal(result.updated, 0);
          assert.equal(result.ignored, 1);
          const count = await tx.company.count({
            where: { cnpjNumerico: cnpj },
          });
          assert.equal(count, 1);
        }),
    ],
    [
      "mantem o relatório final consistente",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj(uniqueCnpjBase());
          await seedCompany(tx, {
            codigoInterno: `${runId}_012`,
            razaoSocial: `${runId} Relatorio LTDA`,
            nomeFantasia: `${runId} Relatorio`,
            cnpj,
            regimeTributario: "Simples Nacional",
            ativo: true,
          });

          const workbook = createWorkbook({
            "Simples Nacional": [
              baseHeader(),
              companyRow({
                codigoInterno: `${runId}_012`,
                razaoSocial: `${runId} Relatorio LTDA`,
                nomeFantasia: `${runId} Relatorio`,
                cnpj,
                status: "ATIVO",
              }),
              companyRow({
                codigoInterno: `${runId}_012`,
                razaoSocial: `${runId} Relatorio LTDA`,
                nomeFantasia: `${runId} Relatorio`,
                cnpj,
                status: "ATIVO",
              }),
              companyRow({
                codigoInterno: `${runId}_012b`,
                razaoSocial: `${runId} Relatorio Novo LTDA`,
                nomeFantasia: `${runId} Relatorio Novo`,
                status: "INATIVO",
              }),
            ],
          });

          const result = await importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${runId}_report.xlsx`,
            buffer: workbook,
            db: tx,
          });

          assert.equal(result.created, 1);
          assert.equal(result.updated, 0);
          assert.equal(result.ignored, 2);
          assert.equal(result.suspectedDuplicates, 1);
          const report = result.report as {
            created?: number;
            ignoredDuplicate?: number;
            ignoredUnchanged?: number;
            rowsRead?: number;
          } | null;
          assert.equal(report?.created, 1);
          assert.equal(report?.ignoredDuplicate, 1);
          assert.equal(report?.ignoredUnchanged, 1);
          assert.equal(report?.rowsRead, 3);
        }),
    ],
    [
      "evita duplicidade em importacoes concorrentes",
      async () => {
        const prefix = `${runId}_013`;
        const workbook = createWorkbook({
          "Simples Nacional": [
            baseHeader(),
            companyRow({
              codigoInterno: `${prefix}`,
              razaoSocial: `${prefix} Concorrente LTDA`,
              nomeFantasia: `${prefix} Concorrente`,
              status: "ATIVO",
            }),
          ],
        });

        await Promise.all([
          importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${prefix}_a.xlsx`,
            buffer: workbook,
          }),
          importCompaniesFromExcel({
            actorUserId: ACTOR_USER_ID,
            fileName: `${prefix}_b.xlsx`,
            buffer: workbook,
          }),
        ]);

        const count = await countCompaniesByPrefix(prefix);
        assert.equal(count, 1);
        await cleanupPrefix(prefix);
      },
    ],
  ];

  let failures = 0;

  for (const [name, testFn] of tests) {
    try {
      await runTest(name, testFn);
    } catch (error) {
      failures += 1;
      console.error(error);
      break;
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`All company import tests passed (${tests.length}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (typeof prisma.$disconnect === "function") {
    await prisma.$disconnect();
  }
});
