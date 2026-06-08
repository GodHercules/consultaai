ALTER TABLE "ImportHistory"
ADD COLUMN IF NOT EXISTS "fileHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ImportHistory_fileHash_key"
ON "ImportHistory"("fileHash");
