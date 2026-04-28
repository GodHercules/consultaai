import { cnpjRaiz, isValidCnpj, normalizeCnpj } from "@/utils/cnpj";
import { normalizeText } from "@/utils/strings";

export type CompanyInput = {
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  grupo?: string | null;
  regimeTributario?: string | null;
  sistema?: string | null;
  certificado?: string | null;
  ativo?: boolean | null;
};

export function normalizeCompany(input: CompanyInput) {
  const cnpjNumerico = normalizeCnpj(input.cnpj);
  const validCnpj = cnpjNumerico && isValidCnpj(cnpjNumerico) ? cnpjNumerico : null;

  return {
    codigoInterno: input.codigoInterno?.trim() || null,
    razaoSocial: input.razaoSocial?.trim() || null,
    nomeFantasia: input.nomeFantasia?.trim() || null,
    cnpj: input.cnpj?.trim() || null,
    cnpjNumerico: validCnpj,
    raizCnpj: validCnpj ? cnpjRaiz(validCnpj) : null,
    grupo: input.grupo?.trim() || null,
    grupoNormalizado: input.grupo ? normalizeText(input.grupo) : null,
    regimeTributario: input.regimeTributario?.trim() || null,
    sistema: input.sistema?.trim() || null,
    certificado: input.certificado?.trim() || null,
    ativo: input.ativo ?? true,
  };
}

