import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { normalizeCompany, type CompanyInput } from "@/services/company/normalize";
import { normalizeText } from "@/utils/strings";

type ColumnMap = Partial<Record<keyof CompanyInput | "ativo", string>>;

function normalizeHeader(header: string) {
  return normalizeText(header).replace(/[^a-z0-9]+/g, " ").trim();
}

function detectColumns(headers: string[]): ColumnMap {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  const pick = (candidates: string[]) => {
    const set = new Set(candidates.map((c) => normalizeHeader(c)));
    return normalized.find((h) => set.has(h.norm))?.raw ?? null;
  };

  return {
    codigoInterno:
      pick(["codigo interno", "codigo", "cod interno", "id interno"]) ?? undefined,
    razaoSocial:
      pick(["razao social", "razão social", "razao", "empresa", "nome"]) ?? undefined,
    nomeFantasia: pick(["nome fantasia", "fantasia"]) ?? undefined,
    cnpj: pick(["cnpj", "cpf/cnpj", "cnpj/cpf"]) ?? undefined,
    grupo: pick(["grupo", "grupo empresarial"]) ?? undefined,
    regimeTributario:
      pick(["regime tributario", "regime tributário", "regime"]) ?? undefined,
    sistema: pick(["sistema"]) ?? undefined,
    certificado: pick(["certificado", "certificado digital"]) ?? undefined,
    ativo: pick(["ativo", "status"]) ?? undefined,
  };
}

function readCell(value: unknown) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

function readBoolean(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  const v = normalizeText(String(value));
  if (["ativo", "ativa", "sim", "s", "true", "1"].includes(v)) return true;
  if (["inativo", "inativa", "nao", "não", "n", "false", "0"].includes(v)) return false;
  return null;
}

export async function importCompaniesFromExcel(input: {
  actorUserId: string;
  fileName: string;
  buffer: ArrayBuffer;
}) {
  const workbook = XLSX.read(input.buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Planilha vazia.");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  if (!rows.length) {
    return prisma.importHistory.create({
      data: { fileName: input.fileName, total: 0, created: 0, updated: 0, ignored: 0, errors: [] },
    });
  }

  const headers = Object.keys(rows[0] ?? {});
  const map = detectColumns(headers);

  const errors: Array<{ row: number; error: string }> = [];
  const unique = new Map<string, ReturnType<typeof normalizeCompany>>();

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 header, +1 1-based
    const companyInput: CompanyInput = {
      codigoInterno: map.codigoInterno ? readCell(row[map.codigoInterno]) : null,
      razaoSocial: map.razaoSocial ? readCell(row[map.razaoSocial]) : null,
      nomeFantasia: map.nomeFantasia ? readCell(row[map.nomeFantasia]) : null,
      cnpj: map.cnpj ? readCell(row[map.cnpj]) : null,
      grupo: map.grupo ? readCell(row[map.grupo]) : null,
      regimeTributario: map.regimeTributario ? readCell(row[map.regimeTributario]) : null,
      sistema: map.sistema ? readCell(row[map.sistema]) : null,
      certificado: map.certificado ? readCell(row[map.certificado]) : null,
      ativo: map.ativo ? readBoolean(row[map.ativo]) : null,
    };

    const normalized = normalizeCompany(companyInput);
    const key =
      normalized.cnpjNumerico ??
      (normalized.codigoInterno ? `ci:${normalized.codigoInterno}` : null);
    if (!key) {
      errors.push({ row: rowNumber, error: "Sem CNPJ válido ou código interno." });
      return;
    }

    unique.set(key, normalized);
  });

  let created = 0;
  let updated = 0;
  let ignored = rows.length - unique.size;

  const entries = Array.from(unique.values());
  const chunkSize = 200;

  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    await prisma.$transaction(async (tx) => {
      for (const data of chunk) {
        try {
          if (data.cnpjNumerico) {
            const existing = await tx.company.findUnique({
              where: { cnpjNumerico: data.cnpjNumerico },
              select: { id: true },
            });
            await tx.company.upsert({
              where: { cnpjNumerico: data.cnpjNumerico },
              create: data,
              update: data,
            });
            if (existing) updated += 1;
            else created += 1;
            continue;
          }

          if (data.codigoInterno) {
            const matches = await tx.company.findMany({
              where: { codigoInterno: data.codigoInterno },
              select: { id: true },
              take: 2,
            });
            if (matches.length > 1) {
              ignored += 1;
              continue;
            }
            if (matches.length === 1) {
              await tx.company.update({ where: { id: matches[0].id }, data });
              updated += 1;
              continue;
            }
            await tx.company.create({ data });
            created += 1;
            continue;
          }
        } catch (e) {
          ignored += 1;
          errors.push({ row: -1, error: (e as Error).message });
        }
      }
    });
  }

  const importHistory = await prisma.importHistory.create({
    data: {
      fileName: input.fileName,
      total: rows.length,
      created,
      updated,
      ignored,
      errors: errors.slice(0, 200),
    },
  });

  await auditLog({
    userId: input.actorUserId,
    action: "IMPORT_EXCEL",
    entity: "ImportHistory",
    entityId: importHistory.id,
    newValue: { fileName: input.fileName, total: rows.length, created, updated, ignored },
  });

  return importHistory;
}
