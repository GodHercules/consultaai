export const TAXATION_TYPES = ["LP", "SN", "LR"] as const;
export type TaxationType = (typeof TAXATION_TYPES)[number];

export const TAXATION_LABELS: Record<TaxationType, string> = {
  LP: "LP - LUCRO PRESUMIDO",
  SN: "SN - SIMPLES NACIONAL",
  LR: "LR - LUCRO REAL",
};

export const TAX_REGIMES = ["COMPETENCIA", "CAIXA"] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  COMPETENCIA: "COMPETÊNCIA",
  CAIXA: "CAIXA",
};

export type CnaeActivity = {
  codigo: string;
  descricao: string;
  principal: boolean;
};

export function normalizeCnaeActivities(value: unknown): CnaeActivity[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const activities: CnaeActivity[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const codigo = String(raw.codigo ?? "").replace(/[^0-9]/g, "").slice(0, 7);
    const descricao = String(raw.descricao ?? "").trim().slice(0, 300);
    if (!codigo || !descricao || seen.has(codigo)) continue;
    seen.add(codigo);
    activities.push({ codigo, descricao, principal: raw.principal === true });
  }
  const principalIndex = activities.findIndex((item) => item.principal);
  return activities.map((item, index) => ({ ...item, principal: principalIndex >= 0 ? index === principalIndex : index === 0 }));
}

export function isBlank(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}
