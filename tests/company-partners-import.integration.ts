import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { importCompaniesFromExcel } from "@/services/import/importExcel";
import { normalizeCompany } from "@/services/company/normalize";
import { makeValidCnpj } from "./import-test-helpers";

const rollbackSignal = new Error("ROLLBACK_PARTNER_IMPORT_TEST");

function createWorkbook(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Planilha");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function baseHeader(partnerCount: number) {
  const headers = [
    "Codigo Interno",
    "Razao Social",
    "Nome Fantasia",
    "CNPJ",
    "Telefone Empresa",
    "Email Contato",
  ];

  for (let index = 1; index <= partnerCount; index += 1) {
    headers.push(`Socio ${index}`);
    headers.push(`Telefone Socio ${index}`);
  }

  headers.push("Status");
  return headers;
}

function buildRow(input: {
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  telefoneEmpresa?: string | null;
  emailContato?: string | null;
  partners?: Array<{ name?: string | null; phone?: string | null }>;
  status?: string | boolean | null;
}) {
  const partners = input.partners ?? [];
  const row: unknown[] = [
    input.codigoInterno ?? null,
    input.razaoSocial ?? null,
    input.nomeFantasia ?? null,
    input.cnpj ?? null,
    input.telefoneEmpresa ?? null,
    input.emailContato ?? null,
  ];

  for (const partner of partners) {
    row.push(partner.name ?? null);
    row.push(partner.phone ?? null);
  }

  row.push(input.status ?? "ATIVO");
  return row;
}

async function withRollback<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw rollbackSignal;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error !== rollbackSignal) {
      throw error;
    }
  }
}

async function main() {
  const actor = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(actor);

  const tests: Array<[string, () => Promise<void>]> = [
    [
      "bloqueia linha sem CNPJ sem interromper a importacao",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj("123456780001");
          const workbook = createWorkbook([
            baseHeader(0),
            buildRow({
              codigoInterno: "PARTNER_001",
              razaoSocial: "PARTNER_001 Empresa Sem CNPJ",
              cnpj: null,
              status: "ATIVO",
            }),
            buildRow({
              codigoInterno: "PARTNER_001B",
              razaoSocial: "PARTNER_001 Empresa Valida",
              cnpj,
              status: "ATIVO",
            }),
          ]);

          const result = await importCompaniesFromExcel({
            actorUserId: actor.id,
            fileName: "partner_missing_cnpj.xlsx",
            buffer: workbook,
            db: tx,
          });
          const report = result.report as Record<string, unknown>;

          assert.equal(result.created, 1);
          assert.equal(result.ignored, 1);
          assert.equal(report.blockedMissingCnpj, 1);
          assert.equal(
            await tx.company.count({
              where: { cnpjNumerico: cnpj },
            }),
            1,
          );
        }),
    ],
    [
      "importa telefone e email da empresa e descarta email invalido",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj("123456780002");
          const workbook = createWorkbook([
            baseHeader(0),
            buildRow({
              codigoInterno: "PARTNER_002",
              razaoSocial: "PARTNER_002 Empresa",
              cnpj,
              telefoneEmpresa: "(11) 99999-9999",
              emailContato: "  CONTATO@EXEMPLO.COM  ",
              status: "ATIVO",
            }),
            buildRow({
              codigoInterno: "PARTNER_002B",
              razaoSocial: "PARTNER_002 Empresa Invalida",
              cnpj: makeValidCnpj("123456780003"),
              telefoneEmpresa: "(11) 88888-8888",
              emailContato: "email-invalido",
              status: "ATIVO",
            }),
          ]);

          const result = await importCompaniesFromExcel({
            actorUserId: actor.id,
            fileName: "partner_contacts.xlsx",
            buffer: workbook,
            db: tx,
          });
          const report = result.report as Record<string, unknown>;

          assert.equal(result.created, 2);
          assert.equal(report.warningsInvalidEmails, 1);

          const companyValid = await tx.company.findFirst({ where: { cnpjNumerico: cnpj } });
          assert.equal(companyValid?.telefoneContatoNumerico, "11999999999");
          assert.equal(companyValid?.emailContato, "contato@exemplo.com");

          const invalidCompany = await tx.company.findFirst({
            where: { cnpjNumerico: makeValidCnpj("123456780003") },
          });
          assert.equal(invalidCompany?.emailContato, null);
        }),
    ],
    [
      "importa socios em colunas dinamicas e com quantidade variavel",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj("123456780004");
          const partnerCount = 8;
          const workbook = createWorkbook([
            baseHeader(partnerCount),
            buildRow({
              codigoInterno: "PARTNER_003",
              razaoSocial: "PARTNER_003 Empresa",
              cnpj,
              partners: Array.from({ length: partnerCount }, (_, index) => ({
                name: `Socio ${index + 1}`,
                phone: `(11) 9000${index + 1}-000${index + 1}`,
              })),
              status: "ATIVO",
            }),
          ]);

          const result = await importCompaniesFromExcel({
            actorUserId: actor.id,
            fileName: "partner_dynamic_columns.xlsx",
            buffer: workbook,
            db: tx,
          });
          const report = result.report as Record<string, unknown>;

          assert.equal(result.created, 1);
          assert.equal(report.partnersCreated, 8);

          const company = await tx.company.findFirst({ where: { cnpjNumerico: cnpj } });
          assert.ok(company);
          assert.equal(
            await tx.companyPartner.count({
              where: { companyId: company!.id },
            }),
            8,
          );
        }),
    ],
    [
      "nao duplica socio existente e atualiza telefone",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj("123456780005");
          const company = await tx.company.create({
            data: normalizeCompany({
              codigoInterno: "PARTNER_004",
              razaoSocial: "PARTNER_004 Empresa",
              nomeFantasia: "PARTNER_004",
              cnpj,
              ativo: true,
            }),
          });

          await tx.companyPartner.create({
            data: {
              companyId: company.id,
              nome: "Alice",
              nomeNormalizado: "alice",
              telefone: "(11) 90000-0000",
              telefoneNormalizado: "11900000000",
            },
          });

          const workbook = createWorkbook([
            baseHeader(2),
            buildRow({
              codigoInterno: "PARTNER_004",
              razaoSocial: "PARTNER_004 Empresa",
              cnpj,
              partners: [
                { name: "Alice", phone: "(11) 98888-7777" },
                { name: "Bob", phone: "(11) 97777-6666" },
              ],
              status: "ATIVO",
            }),
          ]);

          const result = await importCompaniesFromExcel({
            actorUserId: actor.id,
            fileName: "partner_update.xlsx",
            buffer: workbook,
            db: tx,
          });
          const report = result.report as Record<string, unknown>;

          assert.equal(result.updated, 1);
          assert.equal(report.partnersCreated, 1);
          assert.equal(report.partnersUpdated, 1);

          const alice = await tx.companyPartner.findFirst({
            where: { companyId: company.id, nomeNormalizado: "alice" },
          });
          assert.equal(alice?.telefoneNormalizado, "11988887777");
          assert.equal(
            await tx.companyPartner.count({
              where: { companyId: company.id, nomeNormalizado: "alice" },
            }),
            1,
          );
        }),
    ],
    [
      "mantem socio ausente no novo upload",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj("123456780006");
          const company = await tx.company.create({
            data: normalizeCompany({
              codigoInterno: "PARTNER_005",
              razaoSocial: "PARTNER_005 Empresa",
              nomeFantasia: "PARTNER_005",
              cnpj,
              ativo: true,
            }),
          });

          await tx.companyPartner.createMany({
            data: [
              {
                companyId: company.id,
                nome: "Alice",
                nomeNormalizado: "alice",
                telefone: "11900000000",
                telefoneNormalizado: "11900000000",
              },
              {
                companyId: company.id,
                nome: "Bob",
                nomeNormalizado: "bob",
                telefone: "11911111111",
                telefoneNormalizado: "11911111111",
              },
            ],
          });

          const workbook = createWorkbook([
            baseHeader(1),
            buildRow({
              codigoInterno: "PARTNER_005",
              razaoSocial: "PARTNER_005 Empresa",
              cnpj,
              partners: [{ name: "Alice", phone: "11900000000" }],
              status: "ATIVO",
            }),
          ]);

          const result = await importCompaniesFromExcel({
            actorUserId: actor.id,
            fileName: "partner_keep_missing.xlsx",
            buffer: workbook,
            db: tx,
          });
          const report = result.report as Record<string, unknown>;

          assert.equal(result.ignored, 1);
          assert.equal(report.partnersCreated, 0);
          assert.equal(
            await tx.companyPartner.count({
              where: { companyId: company.id },
            }),
            2,
          );
        }),
    ],
    [
      "nao remove socio e nao duplica em nova importacao",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj("123456780007");
          const workbook = createWorkbook([
            baseHeader(2),
            buildRow({
              codigoInterno: "PARTNER_006",
              razaoSocial: "PARTNER_006 Empresa",
              cnpj,
              partners: [
                { name: "Alice", phone: "11900000000" },
                { name: "Bob", phone: "11911111111" },
              ],
              status: "ATIVO",
            }),
          ]);

          const first = await importCompaniesFromExcel({
            actorUserId: actor.id,
            fileName: "partner_idempotent.xlsx",
            buffer: workbook,
            db: tx,
          });
          const second = await importCompaniesFromExcel({
            actorUserId: actor.id,
            fileName: "partner_idempotent_2.xlsx",
            buffer: workbook,
            db: tx,
          });
          const secondReport = second.report as Record<string, unknown>;

          assert.equal(first.created, 1);
          assert.equal(second.created, 0);
          assert.equal(second.updated, 0);
          assert.equal(second.ignored, 1);
          assert.equal(secondReport.partnersCreated, 0);
          assert.equal(secondReport.partnersUpdated, 0);

          const company = await tx.company.findFirst({ where: { cnpjNumerico: cnpj } });
          assert.ok(company);
          assert.equal(
            await tx.companyPartner.count({
              where: { companyId: company!.id },
            }),
            2,
          );
        }),
    ],
    [
      "gera aviso quando existe telefone de socio sem nome",
      () =>
        withRollback(async (tx) => {
          const cnpj = makeValidCnpj("123456780008");
          const workbook = createWorkbook([
            baseHeader(1),
            buildRow({
              codigoInterno: "PARTNER_007",
              razaoSocial: "PARTNER_007 Empresa",
              cnpj,
              partners: [{ name: null, phone: "(11) 90000-0000" }],
              status: "ATIVO",
            }),
          ]);

          const result = await importCompaniesFromExcel({
            actorUserId: actor.id,
            fileName: "partner_missing_name.xlsx",
            buffer: workbook,
            db: tx,
          });
          const report = result.report as Record<string, unknown>;

          assert.equal(report.partnersCreated, 0);
          assert.equal(report.warningsPartnerMissingName, 1);
          const company = await tx.company.findFirst({ where: { cnpjNumerico: cnpj } });
          assert.ok(company);
          assert.equal(
            await tx.companyPartner.count({
              where: { companyId: company!.id },
            }),
            0,
          );
        }),
    ],
  ];

  let failures = 0;
  for (const [name, fn] of tests) {
    process.stdout.write(`- ${name}... `);
    try {
      await fn();
      console.log("ok");
    } catch (error) {
      failures += 1;
      console.log("fail");
      console.error(error);
      break;
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  } else {
    console.log(`All partner import tests passed (${tests.length}).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (typeof prisma.$disconnect === "function") {
    await prisma.$disconnect();
  }
});
