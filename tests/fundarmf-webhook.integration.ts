import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeHmacSha256Hex } from "@/utils/webhookSignature";
import {
  handleFundarmfCompanyCreatedWebhook,
  validateFundarmfPayload,
} from "@/services/integration/fundarmf";
import { normalizeCompany } from "@/services/company/normalize";
import { getTestCookie, makeValidCnpj } from "./import-test-helpers";

const rollbackSignal = new Error("ROLLBACK_FUNDARMF_TEST");

function createFundarmfPayload(overrides?: Partial<Record<string, unknown>>) {
  return {
    event: "company.created",
    source: "FundarMF",
    fundarmf_case_id: `case_${Date.now()}`,
    completed_at: "2026-06-05T12:00:00.000Z",
    company: {
      cnpj: makeValidCnpj(String(Date.now()).slice(-12).padStart(12, "0")),
      razao_social: "Empresa Exemplo LTDA",
      nome_fantasia: "Empresa Exemplo",
      status: "ATIVA",
      data_abertura: "2026-06-05",
      regime_tributario: "SIMPLES_NACIONAL",
      cnae_principal: "6201-5/01",
      cnaes_secundarios: ["6202-3/00"],
      email: "contato@empresa.com.br",
      email_alternativo: "financeiro@empresa.com.br",
      telefone: "(71) 99999-9999",
      whatsapp: "(71) 98888-8888",
      endereco: {
        cep: "40000-000",
        logradouro: "Rua Exemplo",
        numero: "123",
        complemento: "Sala 01",
        bairro: "Centro",
        cidade: "Salvador",
        uf: "BA",
      },
      socios: [
        {
          nome: "Socio Exemplo",
          cpf: "529.982.247-25",
          email: "socio@empresa.com.br",
          telefone: "(71) 97777-7777",
          participacao: 50,
          cargo: "Socio Administrador",
        },
      ],
    },
    ...overrides,
  };
}

function signRequest(input: { payload: Record<string, unknown>; deliveryId: string; timestamp: string; secret: string; apiKey: string }) {
  const rawBody = JSON.stringify(input.payload);
  const signature = computeHmacSha256Hex({
    secret: input.secret,
    message: `${input.timestamp}.company.created.${input.deliveryId}.${rawBody}`,
  });

  const headers = new Headers({
    "content-type": "application/json",
    "x-fundarmf-event": "company.created",
    "x-fundarmf-delivery-id": input.deliveryId,
    "x-fundarmf-timestamp": input.timestamp,
    "x-fundarmf-signature": `v1=${signature}`,
    "x-fundarmf-api-key": input.apiKey,
  });

  return new Request("http://localhost/api/integrations/fundarmf/company-created", {
    method: "POST",
    headers,
    body: rawBody,
  });
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

async function main() {
  const secret = "fundarmf-secret-for-tests-2026";
  const apiKey = "fundarmf-api-key-for-tests-2026";
  process.env.FUNDARMF_WEBHOOK_SECRET = secret;
  process.env.FUNDARMF_API_KEY = apiKey;
  process.env.FUNDARMF_WEBHOOK_TOLERANCE_SECONDS = "300";

  const tests: Array<[string, () => Promise<void>]> = [
    [
      "rejeita payload sem CNPJ",
      async () =>
        withRollback(async (tx) => {
          const deliveryId = `del_${Date.now()}_missing_cnpj`;
          const payload = createFundarmfPayload({
            company: {
              ...(createFundarmfPayload().company as object),
              cnpj: "",
            },
          });

          const request = signRequest({
            payload,
            deliveryId,
            timestamp: String(Date.now()),
            secret,
            apiKey,
          });

          const result = await handleFundarmfCompanyCreatedWebhook(request, tx);
          assert.equal(result.status, 400);
          assert.equal((result.body as { ok?: boolean }).ok, false);
          assert.equal(await tx.integrationEvent.count({ where: { deliveryId } }), 1);
        }),
    ],
    [
      "cria empresa, endereco e socios",
      async () =>
        withRollback(async (tx) => {
          const deliveryId = `del_${Date.now()}_create`;
          const payload = createFundarmfPayload();
          const request = signRequest({
            payload,
            deliveryId,
            timestamp: String(Date.now()),
            secret,
            apiKey,
          });

          const result = await handleFundarmfCompanyCreatedWebhook(request, tx);
          assert.equal(result.status, 201);
          assert.equal((result.body as { action?: string }).action, "created");

          const companyPayload = payload.company as { cnpj: string };
          const cnpj = companyPayload.cnpj.replace(/\D+/g, "");
          const company = await tx.company.findUnique({
            where: { cnpjNumerico: cnpj },
          });
          assert.ok(company);
          assert.equal(company?.externalOrigin, "FundarMF");
          assert.equal(company?.fundarmfCaseId, payload.fundarmf_case_id);
          assert.equal(company?.cep, "40000-000");
          assert.equal(company?.logradouro, "Rua Exemplo");
          assert.equal(company?.cidade, "Salvador");
          assert.equal(company?.uf, "BA");
          assert.equal(company?.cnaePrincipal, "6201-5/01");
          assert.deepEqual(company?.cnaesSecundarios, ["6202-3/00"]);
          assert.equal(company?.emailContato, "contato@empresa.com.br");
          assert.equal(company?.emailContatoAlternativo, "financeiro@empresa.com.br");
          assert.equal(company?.whatsappContatoNumerico, "71988888888");

          const partners = await tx.companyPartner.findMany({
            where: { companyId: company.id },
          });
          assert.equal(partners.length, 1);
          assert.equal(partners[0]?.nome, "Socio Exemplo");
          assert.equal(partners[0]?.cpfNormalizado, "52998224725");
          assert.equal(partners[0]?.emailNormalizado, "socio@empresa.com.br");

          const events = await tx.integrationEvent.findMany({
            where: { deliveryId },
          });
          assert.equal(events.length, 1);
          assert.equal(events[0]?.status, "PROCESSED");
        }),
    ],
    [
      "recusa assinatura invalida",
      async () =>
        withRollback(async (tx) => {
          const payload = createFundarmfPayload();
          const rawBody = JSON.stringify(payload);
          const timestamp = String(Date.now());
          const deliveryId = `del_${Date.now()}_sig`;
          const headers = new Headers({
            "content-type": "application/json",
            "x-fundarmf-event": "company.created",
            "x-fundarmf-delivery-id": deliveryId,
            "x-fundarmf-timestamp": timestamp,
            "x-fundarmf-signature": "v1=" + "0".repeat(64),
            "x-fundarmf-api-key": apiKey,
          });

          const request = new Request("http://localhost/api/integrations/fundarmf/company-created", {
            method: "POST",
            headers,
            body: rawBody,
          });

          const result = await handleFundarmfCompanyCreatedWebhook(request, tx);
          assert.equal(result.status, 401);
          assert.equal((result.body as { error?: string }).error, "INVALID_SIGNATURE");
          assert.equal(await tx.integrationEvent.count({ where: { deliveryId } }), 0);
        }),
    ],
    [
      "nao duplica entrega repetida",
      async () =>
        withRollback(async (tx) => {
          const payload = createFundarmfPayload();
          const deliveryId = `del_${Date.now()}_dup`;
          const timestamp = String(Date.now());

          const first = await handleFundarmfCompanyCreatedWebhook(
            signRequest({ payload, deliveryId, timestamp, secret, apiKey }),
            tx,
          );
          const second = await handleFundarmfCompanyCreatedWebhook(
            signRequest({ payload, deliveryId, timestamp, secret, apiKey }),
            tx,
          );

          assert.equal(first.status, 201);
          assert.equal(second.status, 200);
          assert.equal((second.body as { duplicate?: boolean }).duplicate, true);
          assert.equal(await tx.integrationEvent.count({ where: { deliveryId } }), 1);
          assert.equal(await tx.company.count({ where: { fundarmfCaseId: payload.fundarmf_case_id } }), 1);
        }),
    ],
    [
      "nao sobrescreve dados existentes sem regra clara",
      async () =>
        withRollback(async (tx) => {
          const payload = createFundarmfPayload();
          const companyPayload = payload.company as { cnpj: string };
          const cnpj = companyPayload.cnpj.replace(/\D+/g, "");

          const existing = await tx.company.create({
            data: normalizeCompany({
              cnpj,
              razaoSocial: "Empresa Manual LTDA",
              nomeFantasia: "Manual",
              emailContato: "manual@empresa.com.br",
              telefoneContato: "(11) 90000-0000",
              municipio: "Sao Paulo",
              ativo: true,
            }),
          });

          const result = await handleFundarmfCompanyCreatedWebhook(
            signRequest({
              payload,
              deliveryId: `del_${Date.now()}_existing`,
              timestamp: String(Date.now()),
              secret,
              apiKey,
            }),
            tx,
          );

          assert.equal(result.status, 202);
          assert.equal((result.body as { action?: string }).action, "review_required");

          const company = await tx.company.findUnique({ where: { id: existing.id } });
          assert.equal(company?.razaoSocial, "Empresa Manual LTDA");
          assert.equal(company?.emailContato, "manual@empresa.com.br");
          assert.equal(company?.telefoneContatoNumerico, "11900000000");
          assert.equal(company?.fundarmfCaseId, payload.fundarmf_case_id);
        }),
    ],
    [
      "valida estrutura antes de processar",
      async () => {
        const result = validateFundarmfPayload({
          event: "company.created",
          source: "FundarMF",
          fundarmf_case_id: "abc",
          completed_at: "2026-06-05T12:00:00.000Z",
          company: {
            razao_social: "Invalida",
          },
        });
        assert.equal(result.ok, false);
      },
    ],
    [
      "reprocessa evento falho via endpoint admin",
      async () => {
        const cookie = await getTestCookie(prisma);
        const cnpj = makeValidCnpj(String(Date.now()).slice(-12).padStart(12, "0"));
        const payload = createFundarmfPayload({
          company: {
            ...createFundarmfPayload().company,
            cnpj,
          },
        });
        const deliveryId = `del_${Date.now()}_retry`;

        const event = await prisma.integrationEvent.create({
          data: {
            source: "FundarMF",
            eventType: "company.created",
            deliveryId,
            fundarmfCaseId: payload.fundarmf_case_id,
            companyCnpj: cnpj,
            status: "FAILED",
            payload,
            errorMessage: "SIMULATED_FAILURE",
          },
        });

        try {
          const res = await fetch(`http://localhost:3000/api/admin/integrations/fundarmf/events/${event.id}/retry`, {
            method: "POST",
            headers: { cookie },
          });
          const body = await res.json();

          assert.equal(res.status, 201);
          assert.equal(body.ok, true);
          assert.equal(body.retried, true);
          assert.equal(body.action, "created");

          const company = await prisma.company.findUnique({
            where: { cnpjNumerico: cnpj },
          });
          assert.ok(company);
          assert.equal(company?.fundarmfCaseId, payload.fundarmf_case_id);

          const updatedEvent = await prisma.integrationEvent.findUnique({
            where: { id: event.id },
            select: { status: true, processedAt: true, errorMessage: true },
          });
          assert.equal(updatedEvent?.status, "PROCESSED");
          assert.ok(updatedEvent?.processedAt);
          assert.equal(updatedEvent?.errorMessage, null);
        } finally {
          await prisma.companyPartner.deleteMany({
            where: {
              company: {
                cnpjNumerico: cnpj,
              },
            },
          });
          await prisma.company.deleteMany({
            where: { cnpjNumerico: cnpj },
          });
          await prisma.integrationEvent.deleteMany({
            where: { id: event.id },
          });
        }
      },
    ],
  ];

  let failures = 0;
  for (const [name, fn] of tests) {
    try {
      await runTest(name, fn);
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

  console.log(`All FundarMF webhook tests passed (${tests.length}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (typeof prisma.$disconnect === "function") {
    await prisma.$disconnect();
  }
});
