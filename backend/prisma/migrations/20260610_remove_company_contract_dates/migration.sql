DROP INDEX IF EXISTS "Company_contractStartedAt_idx";
DROP INDEX IF EXISTS "Company_contractEndedAt_idx";
DROP INDEX IF EXISTS "Company_contractPredictedEndedAt_idx";

ALTER TABLE "Company" DROP COLUMN IF EXISTS "contractStartedAt";
ALTER TABLE "Company" DROP COLUMN IF EXISTS "contractEndedAt";
ALTER TABLE "Company" DROP COLUMN IF EXISTS "contractPredictedEndedAt";
