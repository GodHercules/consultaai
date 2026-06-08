ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "contractStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "contractEndedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "contractPredictedEndedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Company_contractStartedAt_idx"
ON "Company"("contractStartedAt");

CREATE INDEX IF NOT EXISTS "Company_contractEndedAt_idx"
ON "Company"("contractEndedAt");

CREATE INDEX IF NOT EXISTS "Company_contractPredictedEndedAt_idx"
ON "Company"("contractPredictedEndedAt");

