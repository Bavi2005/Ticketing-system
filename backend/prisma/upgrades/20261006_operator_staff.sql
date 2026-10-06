-- Additive upgrade for an EXISTING EngineDesk ticketing database only.
-- Apply with psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this-file.sql.
-- New databases: prisma db push. Do not use the legacy receipt migrations.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OPERATOR';
BEGIN;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "zone" TEXT NOT NULL DEFAULT 'CENTRAL';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "zone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "operatorId" TEXT;
CREATE TABLE IF NOT EXISTS "Operator" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Operator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Operator_userId_key" ON "Operator"("userId");
CREATE INDEX IF NOT EXISTS "User_operatorId_idx" ON "User"("operatorId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_operatorId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "waitingSince" TIMESTAMP(3);
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
UPDATE "Ticket" SET "status" = 'IN_PROGRESS' WHERE "status" IN ('NEW', 'ACKNOWLEDGED');
-- Previous waiting time cannot be reconstructed; begin from the last saved update.
UPDATE "Ticket" SET "waitingSince" = "updatedAt" WHERE "status" = 'WAITING' AND "waitingSince" IS NULL;
COMMIT;
