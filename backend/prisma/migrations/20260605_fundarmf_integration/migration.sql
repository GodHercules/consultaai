-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'REVIEW_REQUIRED', 'FAILED', 'DUPLICATE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "cnaePrincipal" TEXT,
ADD COLUMN     "cnaesSecundarios" JSONB,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "dataAbertura" TIMESTAMP(3),
ADD COLUMN     "emailContatoAlternativo" TEXT,
ADD COLUMN     "externalOrigin" TEXT,
ADD COLUMN     "fundarmfCaseId" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "statusCadastral" TEXT,
ADD COLUMN     "syncStatus" TEXT,
ADD COLUMN     "uf" TEXT,
ADD COLUMN     "whatsappContato" TEXT,
ADD COLUMN     "whatsappContatoNumerico" TEXT;

-- AlterTable
ALTER TABLE "CompanyPartner" ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "cpfNormalizado" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailNormalizado" TEXT,
ADD COLUMN     "participacao" INTEGER,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "fundarmfCaseId" TEXT,
    "companyCnpj" TEXT,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationEvent_source_eventType_createdAt_idx" ON "IntegrationEvent"("source", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_fundarmfCaseId_idx" ON "IntegrationEvent"("fundarmfCaseId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_companyCnpj_idx" ON "IntegrationEvent"("companyCnpj");

-- CreateIndex
CREATE INDEX "IntegrationEvent_status_createdAt_idx" ON "IntegrationEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEvent_source_deliveryId_key" ON "IntegrationEvent"("source", "deliveryId");

-- CreateIndex
CREATE INDEX "Company_whatsappContatoNumerico_idx" ON "Company"("whatsappContatoNumerico");

-- CreateIndex
CREATE INDEX "Company_emailContatoAlternativo_idx" ON "Company"("emailContatoAlternativo");

-- CreateIndex
CREATE UNIQUE INDEX "Company_fundarmfCaseId_key" ON "Company"("fundarmfCaseId");

-- CreateIndex
CREATE INDEX "CompanyPartner_cpfNormalizado_idx" ON "CompanyPartner"("cpfNormalizado");

-- CreateIndex
CREATE INDEX "CompanyPartner_emailNormalizado_idx" ON "CompanyPartner"("emailNormalizado");
