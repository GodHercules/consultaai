import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import type { ImportHistory as PrismaImportHistory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { extractUniqueConstraintTarget, isUniqueConstraintError } from "@/services/db/errors";
import { normalizeCnpj, isValidCnpj, cnpjRaiz } from "@/utils/cnpj";
import { isValidEmailAddress, normalizeEmailAddress, normalizePhoneDigits, normalizePhoneDisplay } from "@/utils/contact";
import { normalizeKeyText, normalizeText } from "@/utils/strings";

type ColumnMap = Partial<Record<
  | "qtd"
  | "codigoInterno"
  | "razaoSocial"
  | "nomeFantasia"
  | "observacao"
  | "cnpj"
  | "ehGrupo"
  | "grupo"
  | "regimeTributario"
  | "sistema"
  | "certificado"
  | "anexo"
  | "das"
  | "municipio"
  | "ativo"
  | "telefoneContato"
  | "emailContato",
  number
>>;

type ImportIssue = {
  sheet: string;
  row: number;
  severity: "warning" | "error";
  message: string;
};

type PartnerColumnMap = Map<number, { nameIndex?: number; phoneIndex?: number }>;

type ParsedPartner = {
  slot: number;
  name: string;
  nameNormalizada: string;
  telefone: string | null;
  telefoneNormalizado: string | null;
};

type ParsedRow = {
  rowNumber: number;
  cells: string[];
  rawText: string;
  qtd: number | null;
  codigoInterno: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  observacao: string | null;
  cnpj: string | null;
  cnpjNumerico: string | null;
  ehGrupo: boolean | null;
  grupo: string | null;
  regimeTributario: string | null;
  sistema: string | null;
  certificado: string | null;
  anexo: string | null;
  das: string | null;
  municipio: string | null;
  ativo: boolean | null;
  telefoneContato: string | null;
  telefoneContatoNumerico: string | null;
  emailContato: string | null;
  emailContatoValido: boolean;
  partners: ParsedPartner[];
  warnings: string[];
};

type CompanyRecord = {
  qtd: number | null;
  codigoInterno: string | null;
  codigoInternoNormalizado: string | null;
  razaoSocial: string | null;
  razaoSocialNormalizada: string | null;
  nomeFantasia: string | null;
  observacao: string | null;
  cnpj: string | null;
  cnpjNumerico: string | null;
  raizCnpj: string | null;
  ehGrupo: boolean | null;
  grupo: string | null;
  grupoNormalizado: string | null;
  regimeTributario: string | null;
  regimeNormalizado: string | null;
  sistema: string | null;
  certificado: string | null;
  anexo: string | null;
  das: string | null;
  municipio: string | null;
  telefoneContato: string | null;
  telefoneContatoNumerico: string | null;
  emailContato: string | null;
  identityKind: "CNPJ";
  ativo: boolean;
};

type CompanyUpdateData = Partial<CompanyRecord>;

type StagedCompany = {
  createData: CompanyRecord;
  updateData: CompanyUpdateData;
  rowNumbers: number[];
  sheetNames: string[];
  occurrences: Array<{ sheet: string; row: number }>;
  warnings: string[];
  duplicateRows: number;
  partners: ParsedPartner[];
  conflict: boolean;
  conflictReason?: string | null;
};

type DuplicateGroupReport = {
  cnpjNumerico: string;
  duplicateRows: number;
  rowNumbers: number[];
  sheetNames: string[];
  conflict: boolean;
  conflictReason?: string;
};

type ImportReport = {
  fileName: string;
  sheets: string[];
  rowsRead: number;
  created: number;
  updated: number;
  ignored: number;
  ignoredInvalid: number;
  ignoredDuplicate: number;
  ignoredUnchanged: number;
  blockedMissingCnpj: number;
  partnersCreated: number;
  partnersUpdated: number;
  companyContactUpdates: number;
  contactUpdates: number;
  warningsOptionalFields: number;
  warningsInvalidEmails: number;
  warningsPartnerMissingName: number;
  warningsMissingCnpj: number;
  statusChanges: number;
  suspectedDuplicates: number;
  duplicateGroups: DuplicateGroupReport[];
  issues: ImportIssue[];
  hasChanges: boolean;
  message: string | null;
};

type ImportExecutionOptions = {
  dryRun?: boolean;
};

const GROUP_MARKERS = ["grupo", "grupo empresarial", "grupo economico", "grupo fiscal", "holding"];
const AUXILIARY_MARKERS = [
  "observacao",
  "observacoes",
  "obs",
  "aviso",
  "avisos",
  "nota",
  "notas",
  "resumo",
  "total",
  "subtotal",
  "cabecalho",
  "titulo",
  "pagina",
  "folha",
  "rodape",
  "endereco",
  "telefone",
  "email",
  "contato",
  "descricao",
  "descricao geral",
];
const STATUS_MARKERS = ["ativo", "ativa", "inativo", "inativa", "baixada", "baixado", "desenquadrou"];
const MAX_ISSUES = 300;
const MAX_DUPLICATE_GROUPS = 200;

function normalizeHeader(header: string) {
  return normalizeText(header).replace(/[^a-z0-9]+/g, " ").trim();
}

function readCell(value: unknown) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function readInteger(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const raw = String(value).trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d-]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBoolean(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(String(value));
  if (["ativo", "ativa", "sim", "s", "true", "1"].includes(normalized)) return true;
  if (["inativo", "inativa", "nao", "n", "false", "0"].includes(normalized)) return false;
  return null;
}

function normalizeCnpjDigits(value: string | null | undefined) {
  const digits = normalizeCnpj(value);
  if (!digits || digits.length !== 14) return null;
  return isValidCnpj(digits) ? digits : null;
}

function hasAnyToken(text: string, tokens: string[]) {
  return tokens.some((token) => text.includes(token));
}

function isMeaningfulText(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (hasAnyToken(normalized, AUXILIARY_MARKERS)) return false;
  if (hasAnyToken(normalized, GROUP_MARKERS)) return false;
  if (STATUS_MARKERS.includes(normalized)) return false;
  return /[a-z0-9]/i.test(normalized);
}

const HEADER_CANDIDATES = new Set(
  [
    "qtd",
    "codigo interno",
    "codigo",
    "cod",
    "cod interno",
    "id interno",
    "codigo da empresa",
    "razao social",
    "razao",
    "empresa",
    "nome",
    "nome da empresa",
    "nome fantasia",
    "fantasia",
    "observacao",
    "cnpj",
    "cpf cnpj",
    "cnpj cpf",
    "ehgrupo",
    "eh grupo",
    "grupo",
    "grupo empresarial",
    "grupo economico",
    "regime tributario",
    "regime fiscal",
    "regime",
    "sistema",
    "certificado",
    "certificado digital",
    "anexo",
    "das",
    "ativo",
    "status",
    "situacao",
    "situacao cadastral",
    "municipio",
    "telefone",
    "telefone empresa",
    "telefone contato",
    "telefone da empresa",
    "fone",
    "email",
    "e mail",
    "e mail contato",
    "email contato",
  ].map(normalizeHeader),
);

function scoreHeaderRow(row: unknown[]) {
  return row.reduce<number>((score, value) => {
    const normalized = normalizeHeader(String(value ?? ""));
    if (!normalized) return score;
    return score + (HEADER_CANDIDATES.has(normalized) ? 1 : 0);
  }, 0);
}

function findHeaderRow(matrix: unknown[][]) {
  const limit = Math.min(matrix.length, 10);
  for (let index = 0; index < limit; index += 1) {
    if (scoreHeaderRow(matrix[index] ?? []) >= 2) {
      return index;
    }
  }
  return -1;
}

function detectColumns(headers: unknown[]): ColumnMap {
  const normalized = headers.map((raw, index) => ({
    norm: normalizeHeader(String(raw ?? "")),
    index,
  }));

  const pick = (candidates: string[], exclude: string[] = []) => {
    const candidateSet = new Set(candidates.map((candidate) => normalizeHeader(candidate)));
    return normalized.find((header) => {
      if (!candidateSet.has(header.norm)) return false;
      return !exclude.some((token) => header.norm.includes(token));
    })?.index;
  };

  return {
    qtd: pick(["qtd"]),
    codigoInterno: pick(["codigo interno", "codigo", "cod interno", "id interno", "codigo da empresa"]),
    razaoSocial: pick(["razao social", "razao", "empresa", "nome", "nome da empresa"]),
    nomeFantasia: pick(["nome fantasia", "fantasia"]),
    observacao: pick(["observacao", "observacoes", "obs"]),
    cnpj: pick(["cnpj", "cpf cnpj", "cnpj cpf", "cnpj / cpf"]),
    ehGrupo: pick(["eh grupo", "ehgrupo"]),
    grupo: pick(["grupo", "grupo empresarial", "grupo economico", "grupo econômico"]),
    regimeTributario: pick(["regime tributario", "regime tributário", "regime fiscal", "regime"]),
    sistema: pick(["sistema"]),
    certificado: pick(["certificado", "certificado digital"]),
    anexo: pick(["anexo"]),
    das: pick(["das"]),
    ativo: pick(["ativo", "status", "situacao", "situação", "situacao cadastral"]),
    municipio: pick(["municipio", "município"]),
    telefoneContato: pick(
      ["telefone", "telefone empresa", "telefone contato", "telefone da empresa", "fone", "contato telefonico", "contato telefônico"],
      ["socio"],
    ),
    emailContato: pick(["email", "e mail", "e mail contato", "email contato", "email da empresa"], ["socio"]),
  };
}

function detectPartnerColumns(headers: unknown[]): PartnerColumnMap {
  const normalized = headers.map((raw, index) => ({
    norm: normalizeHeader(String(raw ?? "")),
    index,
  }));

  const columns: PartnerColumnMap = new Map();

  for (const header of normalized) {
    if (!header.norm.includes("socio")) continue;
    const slotMatch = header.norm.match(/(\d+)/g);
    const slot = slotMatch ? Number(slotMatch[slotMatch.length - 1]) : Number.NaN;
    if (!Number.isFinite(slot) || slot < 1) continue;

    const kind: "name" | "phone" =
      header.norm.includes("telefone") || header.norm.includes("tel") || header.norm.includes("fone")
        ? "phone"
        : "name";

    const current = columns.get(slot) ?? {};
    if (kind === "name") {
      current.nameIndex = current.nameIndex ?? header.index;
    } else {
      current.phoneIndex = current.phoneIndex ?? header.index;
    }
    columns.set(slot, current);
  }

  return columns;
}

function extractMappedValue(values: unknown[], index: number | undefined) {
  if (index === undefined) return null;
  return readCell(values[index]);
}

function parsePartnerColumns(values: unknown[], partnerColumns: PartnerColumnMap) {
  const partners: ParsedPartner[] = [];
  const warnings: string[] = [];

  const slots = [...partnerColumns.keys()].sort((a, b) => a - b);
  for (const slot of slots) {
    const column = partnerColumns.get(slot);
    if (!column) continue;

    const name = extractMappedValue(values, column.nameIndex);
    const phoneRaw = extractMappedValue(values, column.phoneIndex);
    const phone = normalizePhoneDisplay(phoneRaw);
    const phoneDigits = normalizePhoneDigits(phoneRaw);

    if (!name && phone) {
      warnings.push("Telefone de sócio sem nome.");
      continue;
    }

    if (!name) {
      continue;
    }

    const nameNormalizada = normalizeKeyText(name);
    if (!nameNormalizada) {
      warnings.push("Nome de sócio informado em formato inválido.");
      continue;
    }

    partners.push({
      slot,
      name,
      nameNormalizada,
      telefone: phone,
      telefoneNormalizado: phoneDigits,
    });

    if (!phoneDigits) {
      warnings.push("Sócio importado, porém sem telefone informado.");
    }
  }

  return { partners, warnings };
}

function hasCompanyIdentity(row: ParsedRow) {
  return Boolean(row.cnpjNumerico || row.razaoSocial || row.nomeFantasia || row.codigoInterno);
}

function isGroupLine(row: ParsedRow) {
  if (row.cnpjNumerico) return false;
  if (row.grupo && !row.razaoSocial && !row.nomeFantasia) return true;
  if (!row.rawText) return false;
  if (!hasAnyToken(row.rawText, GROUP_MARKERS)) return false;
  if (hasAnyToken(row.rawText, ["ltda", "mei", "epp", "eireli", "s a", "s/a", "sociedade"])) return false;
  return row.cells.length <= 4;
}

function isAuxiliaryLine(row: ParsedRow) {
  if (row.cnpjNumerico) return false;
  if (isGroupLine(row)) return false;
  if (!row.rawText) return true;
  return hasAnyToken(row.rawText, AUXILIARY_MARKERS) && !hasCompanyIdentity(row);
}

function parseCompanyFields(
  values: unknown[],
  map: ColumnMap,
  partnerColumns: PartnerColumnMap,
  sheetName: string,
  rowNumber: number,
): ParsedRow {
  const cells = values.map(readCell).filter((value): value is string => Boolean(value));
  const rawText = normalizeText(cells.join(" "));

  const mappedQtd = extractMappedValue(values, map.qtd);
  const mappedCodigoInterno = extractMappedValue(values, map.codigoInterno);
  const mappedRazaoSocial = extractMappedValue(values, map.razaoSocial);
  const mappedNomeFantasia = extractMappedValue(values, map.nomeFantasia);
  const mappedObservacao = extractMappedValue(values, map.observacao);
  const mappedCnpj = extractMappedValue(values, map.cnpj);
  const mappedEhGrupo = extractMappedValue(values, map.ehGrupo);
  const mappedGrupo = extractMappedValue(values, map.grupo);
  const mappedRegimeTributario = extractMappedValue(values, map.regimeTributario);
  const mappedSistema = extractMappedValue(values, map.sistema);
  const mappedCertificado = extractMappedValue(values, map.certificado);
  const mappedAnexo = extractMappedValue(values, map.anexo);
  const mappedDas = extractMappedValue(values, map.das);
  const mappedAtivo = extractMappedValue(values, map.ativo);
  const mappedMunicipio = extractMappedValue(values, map.municipio);
  const mappedTelefoneContato = extractMappedValue(values, map.telefoneContato);
  const mappedEmailContato = extractMappedValue(values, map.emailContato);
  const cnpjNumerico = normalizeCnpjDigits(mappedCnpj ?? cells.map(normalizeCnpjDigits).find(Boolean) ?? null);
  const partnerParse = parsePartnerColumns(values, partnerColumns);
  const emailContato = normalizeEmailAddress(mappedEmailContato);
  const emailContatoValido = Boolean(emailContato && isValidEmailAddress(emailContato));
  const telefoneContatoRaw = normalizePhoneDisplay(mappedTelefoneContato);
  const telefoneContatoNumerico = normalizePhoneDigits(mappedTelefoneContato);
  const inferredRazao = cells.find(isMeaningfulText) ?? null;

  return {
    rowNumber,
    cells,
    rawText,
    qtd: readInteger(mappedQtd),
    codigoInterno: mappedCodigoInterno ?? null,
    razaoSocial: mappedRazaoSocial ?? inferredRazao,
    nomeFantasia: mappedNomeFantasia ?? null,
    observacao: mappedObservacao ?? null,
    cnpj: cnpjNumerico,
    cnpjNumerico,
    ehGrupo: mappedEhGrupo !== null ? readBoolean(mappedEhGrupo) : null,
    grupo: mappedGrupo ?? null,
    regimeTributario: mappedRegimeTributario ?? null,
    sistema: mappedSistema ?? null,
    certificado: mappedCertificado ?? null,
    anexo: mappedAnexo ?? null,
    das: mappedDas ?? null,
    municipio: mappedMunicipio ?? null,
    ativo: mappedAtivo !== null ? readBoolean(mappedAtivo) : null,
    telefoneContato: telefoneContatoRaw,
    telefoneContatoNumerico,
    emailContato,
    emailContatoValido,
    partners: partnerParse.partners,
    warnings: partnerParse.warnings,
  };
}

function buildCompanyWarnings(row: ParsedRow) {
  const warnings: string[] = [...row.warnings];

  if (!row.telefoneContatoNumerico) {
    warnings.push("Empresa importada, porém sem telefone de contato informado.");
  }

  if (!row.emailContato) {
    warnings.push("Empresa importada, porém sem e-mail de contato informado.");
  } else if (!row.emailContatoValido) {
    warnings.push("Empresa importada, porém o e-mail informado parece inválido.");
  }

  if (!row.partners.length) {
    warnings.push("Empresa importada, porém sem dados de sócios informados.");
  }

  return warnings;
}

function buildImportCompanyData(row: ParsedRow): CompanyRecord {
  return {
    qtd: row.qtd,
    codigoInterno: row.codigoInterno?.trim() || null,
    codigoInternoNormalizado: normalizeKeyText(row.codigoInterno),
    razaoSocial: row.razaoSocial?.trim() || null,
    razaoSocialNormalizada: normalizeKeyText(row.razaoSocial),
    nomeFantasia: row.nomeFantasia?.trim() || null,
    observacao: row.observacao?.trim() || null,
    cnpj: row.cnpj,
    cnpjNumerico: row.cnpjNumerico,
    raizCnpj: row.cnpjNumerico ? cnpjRaiz(row.cnpjNumerico) : null,
    ehGrupo: row.ehGrupo,
    grupo: row.grupo?.trim() || null,
    grupoNormalizado: normalizeKeyText(row.grupo),
    regimeTributario: row.regimeTributario?.trim() || null,
    regimeNormalizado: normalizeKeyText(row.regimeTributario),
    sistema: row.sistema?.trim() || null,
    certificado: row.certificado?.trim() || null,
    anexo: row.anexo?.trim() || null,
    das: row.das?.trim() || null,
    municipio: row.municipio?.trim() || null,
    telefoneContato: row.telefoneContato,
    telefoneContatoNumerico: row.telefoneContatoNumerico,
    emailContato: row.emailContatoValido ? row.emailContato : null,
    identityKind: "CNPJ",
    ativo: row.ativo === null ? true : row.ativo,
  };
}

function buildImportUpdateData(row: ParsedRow): CompanyUpdateData {
  const data: CompanyUpdateData = {};

  if (row.qtd !== null) data.qtd = row.qtd;
  if (row.codigoInterno) {
    data.codigoInterno = row.codigoInterno.trim();
  }
  if (row.razaoSocial) {
    data.razaoSocial = row.razaoSocial.trim();
  }
  if (row.nomeFantasia) data.nomeFantasia = row.nomeFantasia.trim();
  if (row.observacao) data.observacao = row.observacao.trim();
  if (row.ehGrupo !== null) data.ehGrupo = row.ehGrupo;
  if (row.grupo) {
    data.grupo = row.grupo.trim();
  }
  if (row.regimeTributario) {
    data.regimeTributario = row.regimeTributario.trim();
  }
  if (row.sistema) data.sistema = row.sistema.trim();
  if (row.certificado) data.certificado = row.certificado.trim();
  if (row.anexo) data.anexo = row.anexo.trim();
  if (row.das) data.das = row.das.trim();
  if (row.municipio) data.municipio = row.municipio.trim();
  if (row.telefoneContatoNumerico) {
    data.telefoneContato = row.telefoneContato;
    data.telefoneContatoNumerico = row.telefoneContatoNumerico;
  }
  if (row.emailContatoValido && row.emailContato) {
    data.emailContato = row.emailContato;
  }
  if (row.ativo !== null) data.ativo = row.ativo;

  return data;
}

function mergePartnerLists(current: ParsedPartner[], incoming: ParsedPartner[]) {
  const merged = new Map<string, ParsedPartner>();
  const warnings: string[] = [];

  for (const partner of [...current, ...incoming]) {
    const existing = merged.get(partner.nameNormalizada);
    if (!existing) {
      merged.set(partner.nameNormalizada, { ...partner });
      continue;
    }

    if (partner.telefoneNormalizado && partner.telefoneNormalizado !== existing.telefoneNormalizado) {
      warnings.push(`Telefone atualizado para o sócio ${partner.name}.`);
    }

    merged.set(partner.nameNormalizada, {
      ...existing,
      telefone: partner.telefone ?? existing.telefone,
      telefoneNormalizado: partner.telefoneNormalizado ?? existing.telefoneNormalizado,
    });
  }

  return { partners: [...merged.values()], warnings };
}

function draftSignature(draft: StagedCompany) {
  const partnerSignature = [...draft.partners]
    .sort((a, b) => a.nameNormalizada.localeCompare(b.nameNormalizada))
    .map((partner) => `${partner.nameNormalizada}:${partner.telefoneNormalizado ?? ""}`)
    .join("|");

  return JSON.stringify({
    cnpjNumerico: draft.createData.cnpjNumerico,
    codigoInterno: draft.createData.codigoInternoNormalizado ?? normalizeKeyText(draft.createData.codigoInterno),
    razaoSocial: draft.createData.razaoSocialNormalizada ?? normalizeKeyText(draft.createData.razaoSocial),
    nomeFantasia: normalizeKeyText(draft.createData.nomeFantasia),
    grupo: draft.createData.grupoNormalizado ?? normalizeKeyText(draft.createData.grupo),
    regime: draft.createData.regimeNormalizado ?? normalizeKeyText(draft.createData.regimeTributario),
    sistema: normalizeKeyText(draft.createData.sistema),
    certificado: normalizeKeyText(draft.createData.certificado),
    anexo: normalizeKeyText(draft.createData.anexo),
    das: normalizeKeyText(draft.createData.das),
    municipio: normalizeKeyText(draft.createData.municipio),
    telefoneContatoNumerico: draft.createData.telefoneContatoNumerico,
    emailContato: draft.createData.emailContato,
    ativo: draft.createData.ativo,
    partnerSignature,
  });
}

function mergeDraft(current: StagedCompany, incoming: StagedCompany) {
  const rowNumbers = [...new Set([...current.rowNumbers, ...incoming.rowNumbers])].sort((a, b) => a - b);
  const sheetNames = [...new Set([...current.sheetNames, ...incoming.sheetNames])];
  const occurrences = [...current.occurrences, ...incoming.occurrences];
  const warnings = [...new Set([...current.warnings, ...incoming.warnings])];
  const updateData: CompanyUpdateData = { ...current.updateData, ...incoming.updateData };
  const createData: CompanyRecord = { ...current.createData };

  for (const [key, value] of Object.entries(incoming.updateData)) {
    if (value === undefined) continue;
    (createData as Record<string, unknown>)[key] = value;
  }

  const mergedPartners = mergePartnerLists(current.partners, incoming.partners);
  warnings.push(...mergedPartners.warnings);
  const signatureChanged = draftSignature(current) !== draftSignature(incoming);

  return {
    createData,
    updateData,
    rowNumbers,
    sheetNames,
    occurrences,
    warnings: [...new Set(warnings)],
    duplicateRows: Math.max(0, occurrences.length - 1),
    partners: mergedPartners.partners,
    conflict: current.conflict || incoming.conflict || signatureChanged,
    conflictReason:
      current.conflictReason ??
      incoming.conflictReason ??
      (signatureChanged ? "Duplicidades consolidadas com dados diferentes no arquivo." : null),
  };
}

function buildDuplicateGroupReport(item: StagedCompany): DuplicateGroupReport {
  return {
    cnpjNumerico: item.createData.cnpjNumerico as string,
    duplicateRows: item.duplicateRows,
    rowNumbers: item.rowNumbers,
    sheetNames: item.sheetNames,
    conflict: item.conflict,
    conflictReason: item.conflictReason ?? undefined,
  };
}

function toCompanyCreateData(data: CompanyRecord) {
  return data;
}

function comparableFieldValue(key: string, value: unknown) {
  if (value === null || value === undefined) return null;

  switch (key) {
    case "qtd":
      return typeof value === "number" && Number.isFinite(value) ? value : Number(value);
    case "ativo":
    case "ehGrupo":
      return Boolean(value);
    case "telefoneContato":
    case "telefoneContatoNumerico":
      return normalizePhoneDigits(String(value));
    case "emailContato":
      return normalizeEmailAddress(String(value));
    default:
      return normalizeKeyText(String(value));
  }
}

function buildCompanyUpdatePayload(existing: Record<string, unknown>, data: CompanyUpdateData) {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (comparableFieldValue(key, existing[key]) !== comparableFieldValue(key, value)) {
      payload[key] = value;
    }
  }

  return payload;
}

async function findExistingCompany(db: Prisma.TransactionClient | typeof prisma, cnpjNumerico: string) {
  return db.company.findFirst({
    where: { cnpjNumerico },
    select: {
      id: true,
      qtd: true,
      codigoInterno: true,
      codigoInternoNormalizado: true,
      razaoSocial: true,
      razaoSocialNormalizada: true,
      nomeFantasia: true,
      observacao: true,
      cnpj: true,
      cnpjNumerico: true,
      raizCnpj: true,
      ehGrupo: true,
      grupo: true,
      grupoNormalizado: true,
      regimeTributario: true,
      regimeNormalizado: true,
      sistema: true,
      certificado: true,
      anexo: true,
      das: true,
      municipio: true,
      telefoneContato: true,
      telefoneContatoNumerico: true,
      emailContato: true,
      identityKind: true,
      ativo: true,
    },
  });
}

async function findExistingCompanyByIdentity(
  db: Prisma.TransactionClient | typeof prisma,
  data: CompanyRecord,
  uniqueTargets: string[] = [],
) {
  const targets = uniqueTargets.length
    ? uniqueTargets
    : ["cnpjNumerico", "codigoInternoNormalizado", "razaoSocialNormalizada", "regimeNormalizado"];

  const candidates = new Map<string, Awaited<ReturnType<typeof findExistingCompany>>>();

  const addCandidate = async (company: Awaited<ReturnType<typeof findExistingCompany>> | null) => {
    if (!company) return;
    candidates.set(company.id, company);
  };

  if (targets.includes("cnpjNumerico") && data.cnpjNumerico) {
    await addCandidate(await findExistingCompany(db, data.cnpjNumerico));
  }

  if (targets.includes("codigoInternoNormalizado") && data.codigoInternoNormalizado) {
    await addCandidate(
      await db.company.findFirst({
        where: { codigoInternoNormalizado: data.codigoInternoNormalizado },
        select: {
          id: true,
          qtd: true,
          codigoInterno: true,
          codigoInternoNormalizado: true,
          razaoSocial: true,
          razaoSocialNormalizada: true,
          nomeFantasia: true,
          observacao: true,
          cnpj: true,
          cnpjNumerico: true,
          raizCnpj: true,
          ehGrupo: true,
          grupo: true,
          grupoNormalizado: true,
          regimeTributario: true,
          regimeNormalizado: true,
          sistema: true,
          certificado: true,
          anexo: true,
          das: true,
          municipio: true,
          telefoneContato: true,
          telefoneContatoNumerico: true,
          emailContato: true,
          identityKind: true,
          ativo: true,
        },
      }),
    );
  }

  if (
    targets.includes("razaoSocialNormalizada") &&
    targets.includes("regimeNormalizado") &&
    data.razaoSocialNormalizada &&
    data.regimeNormalizado
  ) {
    await addCandidate(
      await db.company.findFirst({
        where: {
          razaoSocialNormalizada: data.razaoSocialNormalizada,
          regimeNormalizado: data.regimeNormalizado,
        },
        select: {
          id: true,
          qtd: true,
          codigoInterno: true,
          codigoInternoNormalizado: true,
          razaoSocial: true,
          razaoSocialNormalizada: true,
          nomeFantasia: true,
          observacao: true,
          cnpj: true,
          cnpjNumerico: true,
          raizCnpj: true,
          ehGrupo: true,
          grupo: true,
          grupoNormalizado: true,
          regimeTributario: true,
          regimeNormalizado: true,
          sistema: true,
          certificado: true,
          anexo: true,
          das: true,
          municipio: true,
          telefoneContato: true,
          telefoneContatoNumerico: true,
          emailContato: true,
          identityKind: true,
          ativo: true,
        },
      }),
    );
  }

  const uniqueCandidates = [...candidates.values()];
  if (uniqueCandidates.length === 1) return uniqueCandidates[0];
  return null;
}

async function findExistingPartner(
  db: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  nameNormalizada: string,
) {
  return db.companyPartner.findFirst({
    where: { companyId, nomeNormalizado: nameNormalizada },
    select: {
      id: true,
      nome: true,
      nomeNormalizado: true,
      telefone: true,
      telefoneNormalizado: true,
    },
  });
}

function stripConflictingCompanyFields(data: CompanyUpdateData, targets: string[]) {
  const safeData: CompanyUpdateData = { ...data };

  if (targets.includes("cnpjNumerico")) {
    delete safeData.cnpj;
    delete safeData.cnpjNumerico;
  }

  if (targets.includes("codigoInternoNormalizado")) {
    delete safeData.codigoInterno;
    delete safeData.codigoInternoNormalizado;
  }

  if (targets.includes("razaoSocialNormalizada")) {
    delete safeData.razaoSocial;
    delete safeData.razaoSocialNormalizada;
  }

  if (targets.includes("regimeNormalizado")) {
    delete safeData.regimeTributario;
    delete safeData.regimeNormalizado;
  }

  return safeData;
}

function buildUniqueConflictMessage(targets: string[], rowNumber: number | null) {
  const readableTargets = targets.length ? targets.join(", ") : "chave única";
  const rowSuffix = rowNumber ? ` na linha ${rowNumber}` : "";
  return `Conflito de unicidade${rowSuffix}: ${readableTargets}.`;
}

async function importCompaniesInTransaction(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    actorUserId: string;
    fileName: string;
    workbook: XLSX.WorkBook;
    sheetNames: string[];
    fileHash?: string;
  },
  options: ImportExecutionOptions = {},
) {
  const dryRun = Boolean(options.dryRun);

  if (!dryRun && input.fileHash) {
    const existingHistory = await db.importHistory.findFirst({
      where: { fileHash: input.fileHash },
      orderBy: { createdAt: "desc" },
    });

    if (existingHistory) {
      return existingHistory;
    }
  }

  const issues: ImportIssue[] = [];
  const staged = new Map<string, StagedCompany>();
  let rowsRead = 0;
  let ignoredInvalid = 0;
  let ignoredDuplicate = 0;
  let ignoredUnchanged = 0;
  let blockedMissingCnpj = 0;
  let created = 0;
  let updated = 0;
  let partnersCreated = 0;
  let partnersUpdated = 0;
  let companyContactUpdates = 0;
  let statusChanges = 0;
  let warningsOptionalFields = 0;
  let warningsInvalidEmails = 0;
  let warningsPartnerMissingName = 0;
  let warningsMissingCnpj = 0;

  for (const sheetName of input.sheetNames) {
    const sheet = input.workbook.Sheets[sheetName];
    if (!sheet) continue;

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    }) as unknown[][];

    if (!matrix.length) continue;

    const headerRowIndex = findHeaderRow(matrix);
    const columnMap = headerRowIndex >= 0 ? detectColumns(matrix[headerRowIndex] ?? []) : {};
    const partnerColumns = headerRowIndex >= 0
      ? detectPartnerColumns(matrix[headerRowIndex] ?? [])
      : new Map<number, { nameIndex?: number; phoneIndex?: number }>();
    let currentGroup: string | null = null;

    for (let index = 0; index < matrix.length; index += 1) {
      const values = matrix[index] ?? [];
      const rowNumber = index + 1;
      const parsed = parseCompanyFields(values, columnMap, partnerColumns, sheetName, rowNumber);

      if (!parsed.rawText) continue;
      if (headerRowIndex >= 0 && index <= headerRowIndex) continue;

      if (isGroupLine(parsed)) {
        const groupLabel = parsed.grupo || parsed.razaoSocial || parsed.nomeFantasia || parsed.rawText.replace(/^grupo\s*/i, "").trim();
        currentGroup = groupLabel || currentGroup;
        continue;
      }

      if (isAuxiliaryLine(parsed)) continue;

      rowsRead += 1;

      if (!parsed.cnpjNumerico) {
        if (!parsed.cnpj) {
          blockedMissingCnpj += 1;
          warningsMissingCnpj += 1;
          issues.push({
            sheet: sheetName,
            row: rowNumber,
            severity: "error",
            message: "Linha bloqueada por ausência de CNPJ.",
          });
        } else {
          ignoredInvalid += 1;
          issues.push({
            sheet: sheetName,
            row: rowNumber,
            severity: "error",
            message: "CNPJ inválido na linha importada.",
          });
        }
        continue;
      }

      const rowWarnings = buildCompanyWarnings(parsed);
      warningsOptionalFields += rowWarnings.filter((warning) =>
        warning.includes("telefone de contato") ||
        warning.includes("e-mail de contato") ||
        warning.includes("dados de sócios") ||
        warning.includes("sem telefone informado"),
      ).length;
      warningsInvalidEmails += rowWarnings.filter((warning) => warning.includes("e-mail informado parece inválido")).length;
      warningsPartnerMissingName += rowWarnings.filter((warning) => warning.includes("Telefone de sócio sem nome")).length;

      const createData = buildImportCompanyData({
        ...parsed,
        grupo: parsed.grupo || currentGroup,
      });
      const updateData = buildImportUpdateData({
        ...parsed,
        grupo: parsed.grupo || currentGroup,
      });

      const draft: StagedCompany = {
        createData,
        updateData,
        rowNumbers: [rowNumber],
        sheetNames: [sheetName],
        occurrences: [{ sheet: sheetName, row: rowNumber }],
        warnings: rowWarnings,
        duplicateRows: 0,
        partners: parsed.partners,
        conflict: false,
        conflictReason: null,
      };

      const existing = staged.get(createData.cnpjNumerico as string);
      if (!existing) {
        staged.set(createData.cnpjNumerico as string, draft);
        continue;
      }

      const merged = mergeDraft(existing, draft);
      staged.set(createData.cnpjNumerico as string, merged);

      if (draftSignature(existing) !== draftSignature(draft)) {
        issues.push({
          sheet: sheetName,
          row: rowNumber,
          severity: "warning",
          message: `Duplicidade consolidada para o CNPJ ${createData.cnpjNumerico}.`,
        });
      }
    }
  }

  const stagedCompanies = Array.from(staged.values());
  const duplicateGroups = stagedCompanies
    .filter((item) => item.rowNumbers.length > 1)
    .slice(0, MAX_DUPLICATE_GROUPS)
    .map(buildDuplicateGroupReport);

  ignoredDuplicate += stagedCompanies.reduce((sum, item) => sum + item.duplicateRows, 0);
  const duplicateGroupCount = stagedCompanies.filter((item) => item.rowNumbers.length > 1).length;

  const processItem = async (item: StagedCompany) => {
    if (!item.createData.cnpjNumerico) return;

    let existing = await findExistingCompanyByIdentity(db, item.createData);

    if (!existing && !dryRun) {
      try {
        const createdCompany = await db.company.create({
          data: toCompanyCreateData(item.createData),
          select: { id: true },
        });

        for (const partner of item.partners) {
          try {
            await db.companyPartner.create({
              data: {
                companyId: createdCompany.id,
                nome: partner.name,
                nomeNormalizado: partner.nameNormalizada,
                telefone: partner.telefone,
                telefoneNormalizado: partner.telefoneNormalizado,
              },
            });
          } catch (error) {
            if (!isUniqueConstraintError(error)) throw error;
          }
        }

        created += 1;
        partnersCreated += item.partners.length;
        return;
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;

        const targets = extractUniqueConstraintTarget(error);
        const resolvedExisting = await findExistingCompanyByIdentity(db, item.createData, targets);
        if (!resolvedExisting) {
          issues.push({
            sheet: item.sheetNames[0] ?? "unknown",
            row: item.rowNumbers[0] ?? 0,
            severity: "warning",
            message: buildUniqueConflictMessage(targets, item.rowNumbers[0] ?? null),
          });
          ignoredUnchanged += 1;
          return;
        }

        existing = resolvedExisting;
        issues.push({
          sheet: item.sheetNames[0] ?? "unknown",
          row: item.rowNumbers[0] ?? 0,
          severity: "warning",
          message: `Conflito de unicidade resolvido usando o registro existente ${resolvedExisting.cnpjNumerico ?? resolvedExisting.codigoInterno ?? resolvedExisting.razaoSocial ?? resolvedExisting.id}.`,
        });
      }
    }

    if (!existing) {
      created += 1;
      partnersCreated += item.partners.length;
      return;
    }

    const updatePayload = buildCompanyUpdatePayload(existing as Record<string, unknown>, item.updateData);
    const companyNeedsUpdate = Object.keys(updatePayload).length > 0;
    let contactChanged = false;

    if (item.updateData.ativo !== undefined && item.updateData.ativo !== existing.ativo) {
      statusChanges += 1;
    }
    if (item.updateData.telefoneContatoNumerico && item.updateData.telefoneContatoNumerico !== existing.telefoneContatoNumerico) {
      contactChanged = true;
    }
    if (item.updateData.emailContato && item.updateData.emailContato !== existing.emailContato) {
      contactChanged = true;
    }

    let partnerChanged = false;

    for (const partner of item.partners) {
      const partnerExisting = await findExistingPartner(db, existing.id, partner.nameNormalizada);
      if (!partnerExisting) {
        partnersCreated += 1;
        partnerChanged = true;
        if (!dryRun) {
          try {
            await db.companyPartner.create({
              data: {
                companyId: existing.id,
                nome: partner.name,
                nomeNormalizado: partner.nameNormalizada,
                telefone: partner.telefone,
                telefoneNormalizado: partner.telefoneNormalizado,
              },
            });
          } catch (error) {
            if (!isUniqueConstraintError(error)) throw error;
          }
        }
        continue;
      }

      const partnerUpdatePayload: Record<string, unknown> = {};
      if (partner.telefoneNormalizado && partner.telefoneNormalizado !== partnerExisting.telefoneNormalizado) {
        partnerUpdatePayload.telefone = partner.telefone;
        partnerUpdatePayload.telefoneNormalizado = partner.telefoneNormalizado;
      }

      if (Object.keys(partnerUpdatePayload).length > 0) {
        partnersUpdated += 1;
        partnerChanged = true;
        if (!dryRun) {
          try {
            await db.companyPartner.update({
              where: { id: partnerExisting.id },
              data: partnerUpdatePayload,
            });
          } catch (error) {
            if (!isUniqueConstraintError(error)) throw error;
          }
        }
      }
    }

    const safeUpdatePayload = updatePayload;

    if (!companyNeedsUpdate && !contactChanged && !partnerChanged) {
      ignoredUnchanged += 1;
      return;
    }

    if (!dryRun && companyNeedsUpdate) {
      try {
        await db.company.update({
          where: { id: existing.id },
          data: safeUpdatePayload,
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;

        const targets = extractUniqueConstraintTarget(error);
        const retryPayload = stripConflictingCompanyFields(safeUpdatePayload, targets);
        if (Object.keys(retryPayload).length === 0) {
          issues.push({
            sheet: item.sheetNames[0] ?? "unknown",
            row: item.rowNumbers[0] ?? 0,
            severity: "warning",
            message: buildUniqueConflictMessage(targets, item.rowNumbers[0] ?? null),
          });
          ignoredUnchanged += 1;
          return;
        }

        await db.company.update({
          where: { id: existing.id },
          data: retryPayload,
        });

        issues.push({
          sheet: item.sheetNames[0] ?? "unknown",
          row: item.rowNumbers[0] ?? 0,
          severity: "warning",
          message: `Alguns campos únicos foram preservados ao atualizar o registro ${existing.cnpjNumerico ?? existing.codigoInterno ?? existing.razaoSocial ?? existing.id}.`,
        });
      }
    }

    if (companyNeedsUpdate || contactChanged || partnerChanged) {
      updated += 1;
    }

    if (contactChanged) {
      if (item.updateData.telefoneContatoNumerico && item.updateData.telefoneContatoNumerico !== existing.telefoneContatoNumerico) {
        companyContactUpdates += 1;
      }
      if (item.updateData.emailContato && item.updateData.emailContato !== existing.emailContato) {
        companyContactUpdates += 1;
      }
    }
  };

  for (const item of stagedCompanies) {
    await processItem(item);
  }

  const contactUpdates = companyContactUpdates + partnersUpdated;
  const ignored = ignoredInvalid + ignoredDuplicate + ignoredUnchanged + blockedMissingCnpj;
  const hasChanges = created > 0 || updated > 0 || partnersCreated > 0 || partnersUpdated > 0 || companyContactUpdates > 0;
  const report: ImportReport = {
    fileName: input.fileName,
    sheets: input.sheetNames,
    rowsRead,
    created,
    updated,
    ignored,
    ignoredInvalid,
    ignoredDuplicate,
    ignoredUnchanged,
    blockedMissingCnpj,
    partnersCreated,
    partnersUpdated,
    companyContactUpdates,
    contactUpdates,
    warningsOptionalFields,
    warningsInvalidEmails,
    warningsPartnerMissingName,
    warningsMissingCnpj,
    statusChanges,
    suspectedDuplicates: duplicateGroupCount,
    duplicateGroups,
    issues: issues.slice(0, MAX_ISSUES),
    hasChanges,
    message: hasChanges
      ? null
      : "Nenhuma alteração encontrada. A planilha enviada já está sincronizada com o banco de dados.",
  };

  if (dryRun) {
    return report;
  }

  const importHistory = await db.importHistory.create({
    data: {
      fileName: input.fileName,
      fileHash: input.fileHash ?? null,
      status: "DONE",
      total: rowsRead,
      created,
      updated,
      ignored,
      suspectedDuplicates: duplicateGroupCount,
      errors: issues.slice(0, MAX_ISSUES),
      report,
    },
  });

  await auditLog({
    userId: input.actorUserId,
    action: "IMPORT_EXCEL",
    entity: "ImportHistory",
    entityId: importHistory.id,
    newValue: report,
    db,
  });

  return importHistory;
}

function toArrayBuffer(buffer: ArrayBuffer | Buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function importCompaniesFromExcelWithMode(
  input: {
    actorUserId: string;
    fileName: string;
    buffer: ArrayBuffer | Buffer;
    fileHash?: string;
    db?: Prisma.TransactionClient | typeof prisma;
  },
  options: ImportExecutionOptions,
): Promise<PrismaImportHistory | ImportReport> {
  const workbook = XLSX.read(toArrayBuffer(input.buffer), { type: "array" });
  const sheetNames = workbook.SheetNames;

  if (!sheetNames.length) {
    const emptyHistoryInput = {
      actorUserId: input.actorUserId,
      fileName: input.fileName,
      workbook,
      sheetNames,
      fileHash: input.fileHash,
    };

    if (input.db) {
      return importCompaniesInTransaction(input.db, emptyHistoryInput, options);
    }

    return importCompaniesInTransaction(prisma, emptyHistoryInput, options);
  }

  if (input.db) {
    return importCompaniesInTransaction(
      input.db,
      {
        actorUserId: input.actorUserId,
        fileName: input.fileName,
        workbook,
        sheetNames,
        fileHash: input.fileHash,
      },
      options,
    );
  }

  return importCompaniesInTransaction(
    prisma,
    {
      actorUserId: input.actorUserId,
      fileName: input.fileName,
      workbook,
      sheetNames,
      fileHash: input.fileHash,
    },
    options,
  );
}

export async function importCompaniesFromExcel(input: {
  actorUserId: string;
  fileName: string;
  buffer: ArrayBuffer | Buffer;
  fileHash?: string;
  db?: Prisma.TransactionClient | typeof prisma;
}): Promise<PrismaImportHistory> {
  return importCompaniesFromExcelWithMode(input, {}) as Promise<PrismaImportHistory>;
}

export async function previewImportCompaniesFromExcel(input: {
  actorUserId: string;
  fileName: string;
  buffer: ArrayBuffer | Buffer;
  db?: Prisma.TransactionClient | typeof prisma;
}): Promise<ImportReport> {
  return importCompaniesFromExcelWithMode(input, { dryRun: true }) as Promise<ImportReport>;
}
