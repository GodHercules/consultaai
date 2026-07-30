import { isValidCnpj, normalizeCnpj } from "@/utils/cnpj";
import { normalizeCnaeActivities, type CnaeActivity } from "@/utils/company";

export type CnpjLookupResult = {
  cnpj: string;
  razaoSocial: string | null;
  municipio: string | null;
  uf: string | null;
  email: string | null;
  telefones: string[];
  atividades: CnaeActivity[];
  provedor: string;
  consultadoEm: string;
};

const cache = new Map<string, { expiresAt: number; value: CnpjLookupResult }>();

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function phone(value: unknown) {
  const normalized = text(value)?.replace(/\s+/g, " ");
  return normalized;
}

export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult> {
  const cnpj = normalizeCnpj(rawCnpj);
  if (!cnpj || !isValidCnpj(cnpj)) throw new Error("INVALID_CNPJ");
  const cached = cache.get(cnpj);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch(`https://kitana.opencnpj.com/cnpj/${cnpj}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("PROVIDER_TIMEOUT");
    throw new Error("PROVIDER_UNAVAILABLE");
  }
  clearTimeout(timeout);
  if (response.status === 404) throw new Error("COMPANY_NOT_FOUND");
  if (response.status === 429) throw new Error("RATE_LIMITED");
  if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || payload.success === false) {
    if (response.status === 404 || payload?.message) throw new Error("COMPANY_NOT_FOUND");
    throw new Error("INCOMPLETE_RESPONSE");
  }
  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;

  const cnaes = Array.isArray(data.cnaes) ? data.cnaes : [];
  const atividades = normalizeCnaeActivities(cnaes.map((item, index) => ({
    codigo: String((item as Record<string, unknown>)?.cnae ?? ""),
    descricao: String((item as Record<string, unknown>)?.descricao ?? ""),
    principal: index === 0,
  })));
  const telefone = phone(data.telefone ?? data.ddd_telefone_1);
  if (!text(data.municipio) && !text(data.email) && !telefone && !atividades.length) {
    throw new Error("INCOMPLETE_RESPONSE");
  }
  const value: CnpjLookupResult = {
    cnpj,
    razaoSocial: text(data.razaoSocial ?? data.razao_social),
    municipio: text(data.municipio),
    uf: text(data.uf)?.toUpperCase() ?? null,
    email: text(data.email)?.toLowerCase() ?? null,
    telefones: [telefone, phone(data.telefone_2 ?? data.ddd_telefone_2)].filter((item): item is string => Boolean(item)),
    atividades,
    provedor: "OpenCNPJ",
    consultadoEm: new Date().toISOString(),
  };
  cache.set(cnpj, { expiresAt: Date.now() + 10 * 60_000, value });
  return value;
}
