ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "telefoneContato" TEXT,
ADD COLUMN IF NOT EXISTS "telefoneContatoNumerico" TEXT,
ADD COLUMN IF NOT EXISTS "emailContato" TEXT;

CREATE INDEX IF NOT EXISTS "Company_telefoneContatoNumerico_idx"
ON "Company"("telefoneContatoNumerico");

CREATE INDEX IF NOT EXISTS "Company_emailContato_idx"
ON "Company"("emailContato");

CREATE TABLE IF NOT EXISTS "CompanyPartner" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "nomeNormalizado" TEXT NOT NULL,
  "telefone" TEXT,
  "telefoneNormalizado" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyPartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyPartner_companyId_nomeNormalizado_key"
ON "CompanyPartner"("companyId", "nomeNormalizado");

CREATE INDEX IF NOT EXISTS "CompanyPartner_companyId_idx"
ON "CompanyPartner"("companyId");

CREATE INDEX IF NOT EXISTS "CompanyPartner_nomeNormalizado_idx"
ON "CompanyPartner"("nomeNormalizado");

CREATE INDEX IF NOT EXISTS "CompanyPartner_telefoneNormalizado_idx"
ON "CompanyPartner"("telefoneNormalizado");

ALTER TABLE "CompanyPartner"
ADD CONSTRAINT "CompanyPartner_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
