import { cnpjRaiz, isValidCnpj, normalizeCnpj } from "@/utils/cnpj";
import { isValidEmailAddress, normalizeEmailAddress, normalizePhoneDigits, normalizePhoneDisplay } from "@/utils/contact";
import { buildCompanyIdentity } from "@/services/company/identity";
import { normalizeText } from "@/utils/strings";

export type CompanyInput = {
  qtd?: number | null;
  codigoInterno?: string | null;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  observacao?: string | null;
  cnpj?: string | null;
  dataAbertura?: Date | string | null;
  statusCadastral?: string | null;
  ehGrupo?: boolean | null;
  grupo?: string | null;
  regimeTributario?: string | null;
  sistema?: string | null;
  certificado?: string | null;
  anexo?: string | null;
  das?: string | null;
  municipio?: string | null;
  telefoneContato?: string | null;
  whatsappContato?: string | null;
  emailContato?: string | null;
  emailContatoAlternativo?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cnaePrincipal?: string | null;
  cnaesSecundarios?: string[] | null;
  externalOrigin?: string | null;
  fundarmfCaseId?: string | null;
  importedAt?: Date | null;
  lastSyncedAt?: Date | null;
  syncStatus?: string | null;
  ativo?: boolean | null;
};

export function normalizeCompany(input: CompanyInput) {
  const cnpjNumerico = normalizeCnpj(input.cnpj);
  const validCnpj = cnpjNumerico && isValidCnpj(cnpjNumerico) ? cnpjNumerico : null;
  const identity = buildCompanyIdentity(input);

  return {
    qtd: input.qtd ?? null,
    codigoInterno: input.codigoInterno?.trim() || null,
    razaoSocial: input.razaoSocial?.trim() || null,
    nomeFantasia: input.nomeFantasia?.trim() || null,
    observacao: input.observacao?.trim() || null,
    cnpj: input.cnpj?.trim() || null,
    cnpjNumerico: validCnpj,
    raizCnpj: validCnpj ? cnpjRaiz(validCnpj) : null,
    dataAbertura:
      input.dataAbertura instanceof Date
        ? input.dataAbertura
        : input.dataAbertura
          ? new Date(input.dataAbertura)
          : null,
    statusCadastral: input.statusCadastral?.trim() || null,
    ehGrupo: input.ehGrupo ?? null,
    codigoInternoNormalizado: identity?.codigoInternoNormalizado ?? null,
    razaoSocialNormalizada: identity?.razaoSocialNormalizada ?? null,
    regimeNormalizado: identity?.regimeNormalizado ?? null,
    identityKind: identity?.kind ?? null,
    grupo: input.grupo?.trim() || null,
    grupoNormalizado: input.grupo ? normalizeText(input.grupo) : null,
    regimeTributario: input.regimeTributario?.trim() || null,
    sistema: input.sistema?.trim() || null,
    certificado: input.certificado?.trim() || null,
    anexo: input.anexo?.trim() || null,
    das: input.das?.trim() || null,
    municipio: input.municipio?.trim() || null,
    telefoneContato: normalizePhoneDisplay(input.telefoneContato),
    telefoneContatoNumerico: normalizePhoneDigits(input.telefoneContato),
    whatsappContato: normalizePhoneDisplay(input.whatsappContato),
    whatsappContatoNumerico: normalizePhoneDigits(input.whatsappContato),
    emailContato: isValidEmailAddress(input.emailContato) ? normalizeEmailAddress(input.emailContato) : null,
    emailContatoAlternativo: isValidEmailAddress(input.emailContatoAlternativo)
      ? normalizeEmailAddress(input.emailContatoAlternativo)
      : null,
    cep: input.cep?.trim() || null,
    logradouro: input.logradouro?.trim() || null,
    numero: input.numero?.trim() || null,
    complemento: input.complemento?.trim() || null,
    bairro: input.bairro?.trim() || null,
    cidade: input.cidade?.trim() || null,
    uf: input.uf?.trim().toUpperCase() || null,
    cnaePrincipal: input.cnaePrincipal?.trim() || null,
    cnaesSecundarios: input.cnaesSecundarios?.map((item) => item.trim()).filter((item): item is string => Boolean(item)) ?? null,
    externalOrigin: input.externalOrigin?.trim() || null,
    fundarmfCaseId: input.fundarmfCaseId?.trim() || null,
    importedAt: input.importedAt ?? null,
    lastSyncedAt: input.lastSyncedAt ?? null,
    syncStatus: input.syncStatus?.trim() || null,
    ativo: input.ativo === undefined ? true : input.ativo,
  };
}
