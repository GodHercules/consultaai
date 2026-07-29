-- CreateEnum
CREATE TYPE "CompanyIdentityKind" AS ENUM ('CNPJ', 'NAME_REGIME', 'CODE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "codigoInternoNormalizado" TEXT,
ADD COLUMN     "identityKind" "CompanyIdentityKind",
ADD COLUMN     "razaoSocialNormalizada" TEXT,
ADD COLUMN     "regimeNormalizado" TEXT;

-- AlterTable
ALTER TABLE "ImportHistory" ADD COLUMN     "report" JSONB,
ADD COLUMN     "suspectedDuplicates" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Company_codigoInternoNormalizado_key" ON "Company"("codigoInternoNormalizado");

-- CreateIndex
CREATE INDEX "Company_codigoInternoNormalizado_idx" ON "Company"("codigoInternoNormalizado");

-- CreateIndex
CREATE INDEX "Company_razaoSocialNormalizada_idx" ON "Company"("razaoSocialNormalizada");

-- CreateIndex
CREATE INDEX "Company_regimeNormalizado_idx" ON "Company"("regimeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "Company_razaoSocialNormalizada_regimeNormalizado_key" ON "Company"("razaoSocialNormalizada", "regimeNormalizado");
