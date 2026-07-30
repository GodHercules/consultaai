import assert from "node:assert/strict";
import { isValidCnpj, normalizeCnpj } from "@/utils/cnpj";
import { normalizeCnaeActivities, TAXATION_TYPES, TAX_REGIMES } from "@/utils/company";

assert.equal(normalizeCnpj("04.252.011/0001-10"), "04252011000110");
assert.equal(isValidCnpj("04252011000110"), true);
assert.deepEqual(TAXATION_TYPES, ["LP", "SN", "LR"]);
assert.deepEqual(TAX_REGIMES, ["COMPETENCIA", "CAIXA"]);
assert.deepEqual(normalizeCnaeActivities([
  { codigo: "6201-5/01", descricao: "Desenvolvimento", principal: true },
  { codigo: "6201501", descricao: "Duplicado", principal: false },
  { codigo: "6920-6/01", descricao: "Contabilidade", principal: true },
]), [
  { codigo: "6201501", descricao: "Desenvolvimento", principal: true },
  { codigo: "6920601", descricao: "Contabilidade", principal: false },
]);

console.log("company-domain tests passed");
