DO $$
BEGIN
  CREATE TYPE "ImportHistoryStatus" AS ENUM ('DONE', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ImportHistory"
ADD COLUMN IF NOT EXISTS "status" "ImportHistoryStatus" NOT NULL DEFAULT 'DONE';
