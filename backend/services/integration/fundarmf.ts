import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { auditLog } from "@/services/audit";
import { isUniqueConstraintError } from "@/services/db/errors";
import { normalizeCompany } from "@/services/company/normalize";
import { isValidCnpj, normalizeCnpj } from "@/utils/cnpj";
import { isValidCpf, normalizeCpf } from "@/utils/cpf";
import { isValidEmailAddress, normalizeEmailAddress, normalizePhoneDigits, normalizePhoneDisplay } from "@/utils/contact";
import { normalizeKeyText, normalizeText } from "@/utils/strings";
import { verifyFundarMfWebhookSignature, verifyTimestampWithinWindow } from "@/utils/webhookSignature";

const SOURCE_NAME = "FundarMF";
const EXPECTED_EVENT = "company.created";
const DEFAULT_TOLERANCE_SECONDS = 300;

const BR_UFS = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

const payloadSchema = z.object({
  event: z.string().min(1),
  source: z.string().min(1),
  fundarmf_case_id: z.string().min(1),
  completed_at: z.string().min(1),
  company: z
    .object({
      cnpj: z.string().min(1),
      razao_social: z.string().min(1),
      nome_fantasia: z.string().optional().nullable(),
      status: z.string().min(1),
      data_abertura: z.string().min(1),
      regime_tributario: z.string().optional().nullable(),
      cnae_principal: z.string().optional().nullable(),
      cnaes_secundarios: z.array(z.string()).optional().nullable(),
      email: z.string().optional().nullable(),
      email_alternativo: z.string().optional().nullable(),
      telefone: z.string().optional().nullable(),
      whatsapp: z.string().optional().nullable(),
      endereco: z.object({
        cep: z.string().min(1),
        logradouro: z.string().min(1),
        numero: z.string().optional().nullable(),
        complemento: z.string().optional().nullable(),
        bairro: z.string().optional().nullable(),
        cidade: z.string().min(1),
        uf: z.string().min(1),
      }),
      socios: z
        .array(
          z.object({
            nome: z.string().min(1),
            cpf: z.string().optional().nullable(),
            email: z.string().optional().nullable(),
            telefone: z.string().optional().nullable(),
            participacao: z.union([z.number(), z.string()]).optional().nullable(),
            cargo: z.string().optional().nullable(),
          }),
        )
        .optional()
        .nullable(),
    })
    .passthrough(),
}).passthrough();

type FundarMfWebhookPayload = z.infer<typeof payloadSchema>;

type ValidationResult =
  | {
      ok: true;
      payload: FundarMfWebhookPayload;
    }
  | {
      ok: false;
      errors: string[];
    };

function sha256Hex(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function isDbClientWithTransaction(db: Prisma.TransactionClient | typeof prisma): db is typeof prisma {
  return typeof (db as typeof prisma).$transaction === "function";
}

function asJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function trimText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStatusText(value: string) {
  return normalizeText(value);
}

function normalizeUf(value: string | null | undefined) {
  if (!value) return null;
  const uf = value.trim().toUpperCase();
  return BR_UFS.has(uf) ? uf : null;
}

function normalizeCep(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function normalizeCnae(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  if (digits.length !== 7) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 5)}/${digits.slice(5)}`;
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRegimeTributario(value: string | null | undefined) {
  if (!value) return null;
  const normalized = normalizeText(value);
  const map: Record<string, string> = {
    simples_nacional: "Simples Nacional",
    "simples nacional": "Simples Nacional",
    lucro_presumido: "Lucro Presumido",
    "lucro presumido": "Lucro Presumido",
    lucro_real: "Lucro Real",
    "lucro real": "Lucro Real",
    mei: "MEI",
  };

  return map[normalized] ?? value.trim();
}

function normalizeCnaes(values: string[] | null | undefined) {
  if (!values?.length) return null;
  const normalized = values
    .map((value) => normalizeCnae(value))
    .filter((value): value is string => Boolean(value));
  return normalized.length ? [...new Set(normalized)] : null;
}

function normalizePhone(value: string | null | undefined) {
  const display = normalizePhoneDisplay(value);
  const digits = normalizePhoneDigits(value);
  return { display, digits };
}

function isAcceptablePhone(value: string | null | undefined) {
  const digits = normalizePhoneDigits(value);
  return Boolean(digits && digits.length >= 10 && digits.length <= 13);
}

function isAcceptableEmail(value: string | null | undefined) {
  return !value || isValidEmailAddress(value);
}

function isAcceptableCnpj(value: string | null | undefined) {
  const digits = normalizeCnpj(value);
  return Boolean(digits && isValidCnpj(digits));
}

function isAcceptableCpf(value: string | null | undefined) {
  if (!value) return true;
  const digits = normalizeCpf(value);
  return Boolean(digits && isValidCpf(digits));
}

function normalizeCompletedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAllowedToleranceSeconds(envTolerance?: number) {
  return (envTolerance ?? DEFAULT_TOLERANCE_SECONDS) * 1000;
}

function validatePayloadStructure(input: unknown): ValidationResult {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message),
    };
  }

  const payload = parsed.data;
  const errors: string[] = [];

  if (normalizeText(payload.event) !== EXPECTED_EVENT) {
    errors.push("event: unsupported event type");
  }

  if (normalizeText(payload.source) !== normalizeText(SOURCE_NAME)) {
    errors.push("source: invalid source");
  }

  const completedAt = normalizeCompletedAt(payload.completed_at);
  if (!completedAt) {
    errors.push("completed_at: invalid date");
  }

  const company = payload.company;
  if (!isAcceptableCnpj(company.cnpj)) {
    errors.push("company.cnpj: invalid CNPJ");
  }

  if (!trimText(company.razao_social)) {
    errors.push("company.razao_social: required");
  }

  const statusNorm = normalizeStatusText(company.status);
  const validStatuses = new Set(["ativo", "ativa", "inativo", "inativa", "baixada", "baixado", "pendente", "suspenso"]);
  if (!validStatuses.has(statusNorm)) {
    errors.push("company.status: invalid status");
  }

  const openingDate = normalizeCompletedAt(company.data_abertura);
  if (!openingDate) {
    errors.push("company.data_abertura: invalid date");
  }

  const uf = normalizeUf(company.endereco.uf);
  if (!uf) {
    errors.push("company.endereco.uf: invalid UF");
  }

  if (!normalizeCep(company.endereco.cep)) {
    errors.push("company.endereco.cep: invalid CEP");
  }

  if (!trimText(company.endereco.logradouro)) {
    errors.push("company.endereco.logradouro: required");
  }

  if (!trimText(company.endereco.cidade)) {
    errors.push("company.endereco.cidade: required");
  }

  if (!isAcceptableEmail(company.email ?? null)) {
    errors.push("company.email: invalid email");
  }

  if (!isAcceptableEmail(company.email_alternativo ?? null)) {
    errors.push("company.email_alternativo: invalid email");
  }

  if (!isAcceptablePhone(company.telefone ?? null)) {
    errors.push("company.telefone: invalid phone");
  }

  if (!isAcceptablePhone(company.whatsapp ?? null)) {
    errors.push("company.whatsapp: invalid phone");
  }

  if (company.cnae_principal && !normalizeCnae(company.cnae_principal)) {
    errors.push("company.cnae_principal: invalid CNAE");
  }

  const cnaesSecundarios = company.cnaes_secundarios ?? null;
  if (cnaesSecundarios?.some((value) => !normalizeCnae(value))) {
    errors.push("company.cnaes_secundarios: invalid CNAE");
  }

  for (const [index, partner] of (company.socios ?? []).entries()) {
    if (!trimText(partner.nome)) {
      errors.push(`company.socios[${index}].nome: required`);
    }
    if (!isAcceptableCpf(partner.cpf ?? null)) {
      errors.push(`company.socios[${index}].cpf: invalid CPF`);
    }
    if (!isAcceptableEmail(partner.email ?? null)) {
      errors.push(`company.socios[${index}].email: invalid email`);
    }
    if (!isAcceptablePhone(partner.telefone ?? null)) {
      errors.push(`company.socios[${index}].telefone: invalid phone`);
    }
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return { ok: true, payload };
}

function parseJsonPayload(rawBody: string) {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

function normalizeIncomingPayload(payload: FundarMfWebhookPayload, syncedAt: Date) {
  const completedAt = normalizeCompletedAt(payload.completed_at);
  const company = payload.company;
  const statusNorm = normalizeStatusText(company.status);
  const active = ["ativo", "ativa", "pendente"].includes(statusNorm) ? true : false;
  const addressCity = trimText(company.endereco.cidade);

  return {
    company: normalizeCompany({
      cnpj: company.cnpj,
      razaoSocial: company.razao_social,
      nomeFantasia: company.nome_fantasia ?? null,
      statusCadastral: company.status.trim(),
      dataAbertura: normalizeDate(company.data_abertura),
      regimeTributario: normalizeRegimeTributario(company.regime_tributario ?? null),
      cnaePrincipal: normalizeCnae(company.cnae_principal ?? null),
      cnaesSecundarios: normalizeCnaes(company.cnaes_secundarios ?? null),
      emailContato: company.email ?? null,
      emailContatoAlternativo: company.email_alternativo ?? null,
      telefoneContato: company.telefone ?? null,
      whatsappContato: company.whatsapp ?? null,
      cep: normalizeCep(company.endereco.cep) ?? null,
      logradouro: trimText(company.endereco.logradouro),
      numero: trimText(company.endereco.numero),
      complemento: trimText(company.endereco.complemento),
      bairro: trimText(company.endereco.bairro),
      cidade: addressCity,
      municipio: addressCity,
      uf: normalizeUf(company.endereco.uf),
      externalOrigin: SOURCE_NAME,
      fundarmfCaseId: payload.fundarmf_case_id,
      importedAt: completedAt ?? syncedAt,
      lastSyncedAt: syncedAt,
      syncStatus: "SYNCED",
      ativo: active,
    }),
    partners: (company.socios ?? []).map((partner) => ({
      nome: partner.nome.trim(),
      nomeNormalizado: normalizeKeyText(partner.nome) as string,
      cpf: normalizeCpf(partner.cpf ?? null),
      cpfNormalizado: normalizeCpf(partner.cpf ?? null),
      email: isValidEmailAddress(partner.email ?? null) ? normalizeEmailAddress(partner.email) : null,
      emailNormalizado: isValidEmailAddress(partner.email ?? null) ? normalizeEmailAddress(partner.email) : null,
      telefone: normalizePhone(partner.telefone ?? null).display,
      telefoneNormalizado: normalizePhone(partner.telefone ?? null).digits,
      participacao:
        partner.participacao === null || partner.participacao === undefined
          ? null
          : Number(String(partner.participacao).replace(/[^\d.]/g, "")) || null,
      cargo: trimText(partner.cargo ?? null),
    })),
  };
}

async function readExistingIntegrationEvent(
  db: Prisma.TransactionClient | typeof prisma,
  deliveryId: string,
) {
  return db.integrationEvent.findUnique({
    where: {
      source_deliveryId: {
        source: SOURCE_NAME,
        deliveryId,
      },
    },
  });
}

async function markIntegrationEvent(
  db: Prisma.TransactionClient | typeof prisma,
  eventId: string,
  data: Partial<{
    status: "RECEIVED" | "PROCESSING" | "PROCESSED" | "REVIEW_REQUIRED" | "FAILED" | "DUPLICATE";
    errorMessage: string | null;
    companyCnpj: string | null;
    fundarmfCaseId: string | null;
    processedAt: Date | null;
    payload: Prisma.InputJsonValue;
  }>,
) {
  await db.integrationEvent.update({
    where: { id: eventId },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.errorMessage === undefined ? {} : { errorMessage: data.errorMessage }),
      ...(data.companyCnpj === undefined ? {} : { companyCnpj: data.companyCnpj }),
      ...(data.fundarmfCaseId === undefined ? {} : { fundarmfCaseId: data.fundarmfCaseId }),
      ...(data.processedAt === undefined ? {} : { processedAt: data.processedAt }),
      ...(data.payload === undefined ? {} : { payload: data.payload }),
    },
  });
}

function compareNullableText(a: unknown, b: unknown) {
  return normalizeKeyText(a === null || a === undefined ? null : String(a)) === normalizeKeyText(b === null || b === undefined ? null : String(b));
}

function compareNullableEmail(a: unknown, b: unknown) {
  return normalizeEmailAddress(a === null || a === undefined ? null : String(a)) === normalizeEmailAddress(b === null || b === undefined ? null : String(b));
}

function compareNullablePhone(a: unknown, b: unknown) {
  return normalizePhoneDigits(a === null || a === undefined ? null : String(a)) === normalizePhoneDigits(b === null || b === undefined ? null : String(b));
}

function compareNullableDate(a: unknown, b: unknown) {
  const dateA = normalizeDate(a as string | Date | null | undefined);
  const dateB = normalizeDate(b as string | Date | null | undefined);
  return dateA?.toISOString() === dateB?.toISOString();
}

function compareNullableJson(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function applyIfMissing<T>(
  patch: Record<string, unknown>,
  conflicts: string[],
  key: string,
  existing: unknown,
  incoming: T | null | undefined,
  comparator: (a: unknown, b: unknown) => boolean,
) {
  if (incoming === null || incoming === undefined || incoming === "") {
    return;
  }

  const existingEmpty = existing === null || existing === undefined || existing === "";
  if (existingEmpty) {
    patch[key] = incoming as unknown;
    return;
  }

  if (!comparator(existing, incoming)) {
    conflicts.push(key);
  }
}

function getPartnerPatch(
  existing: Record<string, unknown>,
  incoming: {
    cpf: string | null;
    cpfNormalizado: string | null;
    email: string | null;
    emailNormalizado: string | null;
    telefone: string | null;
    telefoneNormalizado: string | null;
    participacao: number | null;
    cargo: string | null;
  },
  conflicts: string[],
) {
  const patch: Record<string, unknown> = {};

  applyIfMissing(patch, conflicts, "cpf", existing.cpf, incoming.cpf, compareNullableText);
  applyIfMissing(patch, conflicts, "cpfNormalizado", existing.cpfNormalizado, incoming.cpfNormalizado, compareNullableText);
  applyIfMissing(patch, conflicts, "email", existing.email, incoming.email, compareNullableEmail);
  applyIfMissing(patch, conflicts, "emailNormalizado", existing.emailNormalizado, incoming.emailNormalizado, compareNullableEmail);
  applyIfMissing(patch, conflicts, "telefone", existing.telefone, incoming.telefone, compareNullablePhone);
  applyIfMissing(patch, conflicts, "telefoneNormalizado", existing.telefoneNormalizado, incoming.telefoneNormalizado, compareNullablePhone);
  applyIfMissing(patch, conflicts, "participacao", existing.participacao, incoming.participacao, compareNullableJson);
  applyIfMissing(patch, conflicts, "cargo", existing.cargo, incoming.cargo, compareNullableText);

  return patch;
}

async function processFundarmfCompanyCreated(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    payload: FundarMfWebhookPayload;
    syncedAt: Date;
  },
) {
  const normalized = normalizeIncomingPayload(input.payload, input.syncedAt);
  const cnpjNumerico = normalized.company.cnpjNumerico;
  if (!cnpjNumerico) {
    throw new Error("FUNDARMF_INVALID_CNPJ");
  }

  const conflicts: string[] = [];
  let partnerCreated = 0;
  let partnerUpdated = 0;
  let companyUpdated = false;

  const existingCompany = await db.company.findFirst({
    where: { cnpjNumerico },
    select: {
      id: true,
      externalOrigin: true,
      fundarmfCaseId: true,
      importedAt: true,
      lastSyncedAt: true,
      syncStatus: true,
      ativo: true,
      dataAbertura: true,
      statusCadastral: true,
      telefoneContato: true,
      telefoneContatoNumerico: true,
      whatsappContato: true,
      whatsappContatoNumerico: true,
      emailContato: true,
      emailContatoAlternativo: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      uf: true,
      cnaePrincipal: true,
      cnaesSecundarios: true,
      razaoSocial: true,
      nomeFantasia: true,
      regimeTributario: true,
      municipio: true,
    },
  });

  if (!existingCompany) {
    const company = await db.company.create({
      data: {
        ...normalized.company,
        syncStatus: "IMPORTED",
      },
      select: { id: true, cnpjNumerico: true },
    });

    for (const partner of normalized.partners) {
      await db.companyPartner.create({
        data: {
          companyId: company.id,
          nome: partner.nome,
          nomeNormalizado: partner.nomeNormalizado,
          cpf: partner.cpf,
          cpfNormalizado: partner.cpfNormalizado,
          email: partner.email,
          emailNormalizado: partner.emailNormalizado,
          telefone: partner.telefone,
          telefoneNormalizado: partner.telefoneNormalizado,
          participacao: partner.participacao,
          cargo: partner.cargo,
        },
      });
      partnerCreated += 1;
    }

    return {
      action: "created" as const,
      companyId: company.id,
      companyCnpj: company.cnpjNumerico,
      conflicts,
      partnerCreated,
      partnerUpdated,
      companyUpdated: true,
      syncedAt: input.syncedAt,
    };
  }

  const companyPatch: Record<string, unknown> = {};
  applyIfMissing(companyPatch, conflicts, "externalOrigin", existingCompany.externalOrigin, normalized.company.externalOrigin, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "fundarmfCaseId", existingCompany.fundarmfCaseId, normalized.company.fundarmfCaseId, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "importedAt", existingCompany.importedAt, normalized.company.importedAt, compareNullableDate);
  applyIfMissing(companyPatch, conflicts, "dataAbertura", existingCompany.dataAbertura, normalized.company.dataAbertura, compareNullableDate);
  applyIfMissing(companyPatch, conflicts, "statusCadastral", existingCompany.statusCadastral, normalized.company.statusCadastral, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "telefoneContato", existingCompany.telefoneContato, normalized.company.telefoneContato, compareNullablePhone);
  applyIfMissing(companyPatch, conflicts, "telefoneContatoNumerico", existingCompany.telefoneContatoNumerico, normalized.company.telefoneContatoNumerico, compareNullablePhone);
  applyIfMissing(companyPatch, conflicts, "whatsappContato", existingCompany.whatsappContato, normalized.company.whatsappContato, compareNullablePhone);
  applyIfMissing(companyPatch, conflicts, "whatsappContatoNumerico", existingCompany.whatsappContatoNumerico, normalized.company.whatsappContatoNumerico, compareNullablePhone);
  applyIfMissing(companyPatch, conflicts, "emailContato", existingCompany.emailContato, normalized.company.emailContato, compareNullableEmail);
  applyIfMissing(companyPatch, conflicts, "emailContatoAlternativo", existingCompany.emailContatoAlternativo, normalized.company.emailContatoAlternativo, compareNullableEmail);
  applyIfMissing(companyPatch, conflicts, "cep", existingCompany.cep, normalized.company.cep, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "logradouro", existingCompany.logradouro, normalized.company.logradouro, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "numero", existingCompany.numero, normalized.company.numero, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "complemento", existingCompany.complemento, normalized.company.complemento, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "bairro", existingCompany.bairro, normalized.company.bairro, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "cidade", existingCompany.cidade, normalized.company.cidade, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "uf", existingCompany.uf, normalized.company.uf, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "cnaePrincipal", existingCompany.cnaePrincipal, normalized.company.cnaePrincipal, compareNullableText);
  applyIfMissing(companyPatch, conflicts, "cnaesSecundarios", existingCompany.cnaesSecundarios, normalized.company.cnaesSecundarios, compareNullableJson);
  applyIfMissing(companyPatch, conflicts, "municipio", existingCompany.municipio, normalized.company.municipio, compareNullableText);

  companyPatch.lastSyncedAt = input.syncedAt;
  companyPatch.syncStatus = conflicts.length ? "REVIEW_REQUIRED" : "SYNCED";
  companyPatch.ativo = existingCompany.ativo;

  if (Object.keys(companyPatch).length > 0) {
    await db.company.update({
      where: { id: existingCompany.id },
      data: companyPatch,
    });
    companyUpdated = true;
  }

  for (const partner of normalized.partners) {
    const existingPartner = await db.companyPartner.findFirst({
      where: {
        companyId: existingCompany.id,
        nomeNormalizado: partner.nomeNormalizado,
      },
      select: {
        id: true,
        cpf: true,
        cpfNormalizado: true,
        email: true,
        emailNormalizado: true,
        telefone: true,
        telefoneNormalizado: true,
        participacao: true,
        cargo: true,
      },
    });

    if (!existingPartner) {
      await db.companyPartner.create({
        data: {
          companyId: existingCompany.id,
          nome: partner.nome,
          nomeNormalizado: partner.nomeNormalizado,
          cpf: partner.cpf,
          cpfNormalizado: partner.cpfNormalizado,
          email: partner.email,
          emailNormalizado: partner.emailNormalizado,
          telefone: partner.telefone,
          telefoneNormalizado: partner.telefoneNormalizado,
          participacao: partner.participacao,
          cargo: partner.cargo,
        },
      });
      partnerCreated += 1;
      continue;
    }

    const partnerPatch = getPartnerPatch(existingPartner, partner, conflicts);
    if (Object.keys(partnerPatch).length > 0) {
      await db.companyPartner.update({
        where: { id: existingPartner.id },
        data: partnerPatch,
      });
      partnerUpdated += 1;
    }
  }

  return {
    action: conflicts.length ? "review_required" : companyUpdated || partnerCreated || partnerUpdated ? "updated" : "duplicate",
    companyId: existingCompany.id,
    companyCnpj: cnpjNumerico,
    conflicts,
    partnerCreated,
    partnerUpdated,
    companyUpdated,
    syncedAt: input.syncedAt,
  };
}

async function createIntegrationEvent(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    deliveryId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    fundarmfCaseId: string | null;
    companyCnpj: string | null;
  },
) {
  try {
    return await db.integrationEvent.create({
      data: {
        source: SOURCE_NAME,
        eventType: input.eventType,
        deliveryId: input.deliveryId,
        fundarmfCaseId: input.fundarmfCaseId,
        companyCnpj: input.companyCnpj,
        status: "PROCESSING",
        payload: input.payload,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return db.integrationEvent.findUnique({
        where: {
          source_deliveryId: {
            source: SOURCE_NAME,
            deliveryId: input.deliveryId,
          },
        },
      });
    }
    throw error;
  }
}

export function validateFundarmfPayload(raw: unknown): ValidationResult {
  return validatePayloadStructure(raw);
}

export async function handleFundarmfCompanyCreatedWebhook(request: Request, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const env = getEnv();
  if (!env.FUNDARMF_WEBHOOK_SECRET) {
    return {
      status: 503,
      body: { ok: false, error: "WEBHOOK_NOT_CONFIGURED" },
    };
  }

  const eventHeader = request.headers.get("x-fundarmf-event") ?? "";
  const deliveryId = request.headers.get("x-fundarmf-delivery-id") ?? "";
  const timestamp = request.headers.get("x-fundarmf-timestamp") ?? "";
  const signature = request.headers.get("x-fundarmf-signature") ?? "";
  const apiKeyHeader = request.headers.get("x-fundarmf-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const originHeader = request.headers.get("origin") ?? "";

  if (!eventHeader || !deliveryId || !timestamp || !signature) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_REQUIRED_HEADERS" },
    };
  }

  if (env.FUNDARMF_API_KEY && apiKeyHeader !== env.FUNDARMF_API_KEY) {
    return {
      status: 401,
      body: { ok: false, error: "INVALID_API_KEY" },
    };
  }

  if (env.FUNDARMF_ALLOWED_ORIGIN && originHeader && originHeader !== env.FUNDARMF_ALLOWED_ORIGIN) {
    return {
      status: 403,
      body: { ok: false, error: "FORBIDDEN_ORIGIN" },
    };
  }

  const toleranceSeconds = getAllowedToleranceSeconds(env.FUNDARMF_WEBHOOK_TOLERANCE_SECONDS);
  if (!verifyTimestampWithinWindow({ timestamp, windowMs: toleranceSeconds })) {
    return {
      status: 401,
      body: { ok: false, error: "STALE_TIMESTAMP" },
    };
  }

  const rawBody = await request.text();
  const signatureResult = verifyFundarMfWebhookSignature({
    secret: env.FUNDARMF_WEBHOOK_SECRET,
    timestamp,
    event: eventHeader,
    deliveryId,
    rawBody,
    signatureHeader: signature,
  });

  if (!signatureResult.ok) {
    return {
      status: 401,
      body: { ok: false, error: signatureResult.reason },
    };
  }

  const existingEvent = await readExistingIntegrationEvent(db, deliveryId);
  if (existingEvent) {
    return {
      status: 200,
      body: {
        ok: true,
        duplicate: true,
        eventId: existingEvent.id,
        status: existingEvent.status,
      },
    };
  }

  const parsedBody = parseJsonPayload(rawBody);
  if (!parsedBody) {
    const event = await createIntegrationEvent(db, {
      deliveryId,
      eventType: eventHeader,
      fundarmfCaseId: null,
      companyCnpj: null,
      payload: { rawBody, parseError: "INVALID_JSON" },
    });
    if (!event) {
      return {
        status: 200,
        body: { ok: true, duplicate: true, eventId: null, status: "DUPLICATE" },
      };
    }
    await markIntegrationEvent(db, event.id, {
      status: "FAILED",
      errorMessage: "INVALID_JSON",
      processedAt: new Date(),
    });
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", eventId: event.id },
    };
  }

  const validation = validateFundarmfPayload(parsedBody);
  if (!validation.ok) {
    const validationErrors = "errors" in validation ? validation.errors : [];
    const payloadObject = parsedBody as Record<string, unknown>;
    const fundarmfCaseId = typeof payloadObject.fundarmf_case_id === "string" ? payloadObject.fundarmf_case_id : null;
    const companyCnpj = typeof payloadObject.company === "object" && payloadObject.company && "cnpj" in payloadObject.company
      ? normalizeCnpj((payloadObject.company as Record<string, unknown>).cnpj as string | null | undefined)
      : null;

    const event = await createIntegrationEvent(db, {
      deliveryId,
      eventType: eventHeader,
      fundarmfCaseId,
      companyCnpj,
      payload: asJsonValue(parsedBody),
    });
    if (!event) {
      return {
        status: 200,
        body: { ok: true, duplicate: true, eventId: null, status: "DUPLICATE" },
      };
    }
    await markIntegrationEvent(db, event.id, {
      status: "FAILED",
      errorMessage: validationErrors.join("; "),
      processedAt: new Date(),
    });
    return {
      status: 400,
      body: {
        ok: false,
        error: "INVALID_PAYLOAD",
        details: validationErrors,
        eventId: event.id,
      },
    };
  }

  const payload = validation.payload;
  const syncedAt = new Date();
  const companyCnpj = normalizeCnpj(payload.company.cnpj);
  const eventRecord = await createIntegrationEvent(db, {
    deliveryId,
    eventType: eventHeader,
    fundarmfCaseId: payload.fundarmf_case_id,
    companyCnpj,
    payload: asJsonValue(payload),
  });
  if (!eventRecord) {
    return {
      status: 200,
      body: { ok: true, duplicate: true, eventId: null, status: "DUPLICATE" },
    };
  }

  try {
    const result = isDbClientWithTransaction(db)
      ? await db.$transaction((tx) => processFundarmfCompanyCreated(tx, { payload, syncedAt }))
      : await processFundarmfCompanyCreated(db, { payload, syncedAt });

    await markIntegrationEvent(db, eventRecord.id, {
      status: result.action === "review_required" ? "REVIEW_REQUIRED" : "PROCESSED",
      errorMessage: result.conflicts.length ? result.conflicts.join("; ") : null,
      processedAt: syncedAt,
      companyCnpj: result.companyCnpj ?? companyCnpj,
      fundarmfCaseId: payload.fundarmf_case_id,
    });

    return {
      status: result.action === "created" ? 201 : result.action === "review_required" ? 202 : 200,
      body: {
        ok: true,
        action: result.action,
        eventId: eventRecord.id,
        companyId: result.companyId,
        companyCnpj: result.companyCnpj ?? companyCnpj,
        conflicts: result.conflicts,
        partnerCreated: result.partnerCreated,
        partnerUpdated: result.partnerUpdated,
        companyUpdated: result.companyUpdated,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markIntegrationEvent(db, eventRecord.id, {
      status: "FAILED",
      errorMessage: message.slice(0, 500),
      processedAt: new Date(),
      companyCnpj,
      fundarmfCaseId: payload.fundarmf_case_id,
    }).catch(() => null);

    return {
      status: 500,
      body: {
        ok: false,
        error: "INTEGRATION_FAILED",
        eventId: eventRecord.id,
      },
    };
  }
}

export async function retryFundarmfIntegrationEvent(input: {
  eventId: string;
  actorUserId: string;
  db?: Prisma.TransactionClient | typeof prisma;
}) {
  const db = input.db ?? prisma;
  const event = await db.integrationEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      source: true,
      eventType: true,
      status: true,
      payload: true,
      deliveryId: true,
      companyCnpj: true,
      fundarmfCaseId: true,
      errorMessage: true,
      processedAt: true,
    },
  });

  if (!event) {
    return {
      status: 404,
      body: { ok: false, error: "NOT_FOUND" },
    };
  }

  if (event.source !== SOURCE_NAME) {
    return {
      status: 400,
      body: { ok: false, error: "UNSUPPORTED_SOURCE" },
    };
  }

  if (!["FAILED", "REVIEW_REQUIRED"].includes(event.status)) {
    return {
      status: 400,
      body: { ok: false, error: "NOT_RETRYABLE", status: event.status },
    };
  }

  const payloadValidation = validateFundarmfPayload(event.payload);
  if (!payloadValidation.ok) {
    const details = "errors" in payloadValidation ? payloadValidation.errors : [];
    await db.integrationEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        errorMessage: details.join("; "),
        processedAt: new Date(),
      },
    });

    await auditLog({
      userId: input.actorUserId,
      action: "FUNDARMF_EVENT_RETRY_FAILED",
      entity: "IntegrationEvent",
      entityId: event.id,
      newValue: { error: details, status: "FAILED" },
      db,
    }).catch(() => null);

    return {
      status: 400,
      body: {
        ok: false,
        error: "INVALID_STORED_PAYLOAD",
        details,
        eventId: event.id,
      },
    };
  }

  const payload = payloadValidation.payload;
  const syncedAt = new Date();

  await db.integrationEvent.update({
    where: { id: event.id },
    data: {
      status: "PROCESSING",
      errorMessage: null,
      processedAt: null,
      companyCnpj: normalizeCnpj(payload.company.cnpj),
      fundarmfCaseId: payload.fundarmf_case_id,
    },
  });

  try {
    const result = isDbClientWithTransaction(db)
      ? await db.$transaction((tx) => processFundarmfCompanyCreated(tx, { payload, syncedAt }))
      : await processFundarmfCompanyCreated(db, { payload, syncedAt });

    await db.integrationEvent.update({
      where: { id: event.id },
      data: {
        status: result.action === "review_required" ? "REVIEW_REQUIRED" : "PROCESSED",
        errorMessage: result.conflicts.length ? result.conflicts.join("; ") : null,
        processedAt: syncedAt,
        companyCnpj: result.companyCnpj ?? normalizeCnpj(payload.company.cnpj),
        fundarmfCaseId: payload.fundarmf_case_id,
      },
    });

    await auditLog({
      userId: input.actorUserId,
      action: "FUNDARMF_EVENT_RETRY_SUCCESS",
      entity: "IntegrationEvent",
      entityId: event.id,
      newValue: {
        status: result.action === "review_required" ? "REVIEW_REQUIRED" : "PROCESSED",
        action: result.action,
        companyId: result.companyId ?? null,
        companyCnpj: result.companyCnpj ?? normalizeCnpj(payload.company.cnpj),
      },
      db,
    });

    return {
      status: result.action === "created" ? 201 : result.action === "review_required" ? 202 : 200,
      body: {
        ok: true,
        retried: true,
        action: result.action,
        eventId: event.id,
        companyId: result.companyId,
        companyCnpj: result.companyCnpj ?? normalizeCnpj(payload.company.cnpj),
        conflicts: result.conflicts,
        partnerCreated: result.partnerCreated,
        partnerUpdated: result.partnerUpdated,
        companyUpdated: result.companyUpdated,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.integrationEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        errorMessage: message.slice(0, 500),
        processedAt: new Date(),
      },
    }).catch(() => null);

    await auditLog({
      userId: input.actorUserId,
      action: "FUNDARMF_EVENT_RETRY_FAILED",
      entity: "IntegrationEvent",
      entityId: event.id,
      newValue: { error: message.slice(0, 500), status: "FAILED" },
      db,
    }).catch(() => null);

    return {
      status: 500,
      body: {
        ok: false,
        error: "RETRY_FAILED",
        eventId: event.id,
      },
    };
  }
}

export function buildFundarmfEventKey(input: { deliveryId: string }) {
  return sha256Hex(`${SOURCE_NAME}:${input.deliveryId}`);
}
