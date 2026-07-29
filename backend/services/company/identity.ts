import { isValidCnpj, normalizeCnpj } from "@/utils/cnpj";
import { normalizeKeyText } from "@/utils/strings";

export type CompanyIdentityKind = "CNPJ" | "NAME_REGIME" | "CODE";

export type CompanyIdentityInput = {
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  regimeTributario?: string | null;
};

export type CompanyIdentity = {
  kind: CompanyIdentityKind;
  key: string;
  cnpjNumerico: string | null;
  codigoInternoNormalizado: string | null;
  razaoSocialNormalizada: string | null;
  regimeNormalizado: string | null;
};

export function buildCompanyIdentity(input: CompanyIdentityInput): CompanyIdentity | null {
  const cnpjNumerico = normalizeCnpj(input.cnpj);
  const validCnpj = cnpjNumerico && isValidCnpj(cnpjNumerico) ? cnpjNumerico : null;

  if (validCnpj) {
    return {
      kind: "CNPJ",
      key: `cnpj:${validCnpj}`,
      cnpjNumerico: validCnpj,
      codigoInternoNormalizado: null,
      razaoSocialNormalizada: null,
      regimeNormalizado: null,
    };
  }

  const razaoSocialNormalizada = normalizeKeyText(input.razaoSocial || input.nomeFantasia);
  const regimeNormalizado = normalizeKeyText(input.regimeTributario);
  if (razaoSocialNormalizada && regimeNormalizado) {
    return {
      kind: "NAME_REGIME",
      key: `name:${razaoSocialNormalizada}|regime:${regimeNormalizado}`,
      cnpjNumerico: null,
      codigoInternoNormalizado: null,
      razaoSocialNormalizada,
      regimeNormalizado,
    };
  }

  const codigoInternoNormalizado = normalizeKeyText(input.codigoInterno);
  if (codigoInternoNormalizado) {
    return {
      kind: "CODE",
      key: `code:${codigoInternoNormalizado}`,
      cnpjNumerico: null,
      codigoInternoNormalizado,
      razaoSocialNormalizada: null,
      regimeNormalizado: null,
    };
  }

  return null;
}

