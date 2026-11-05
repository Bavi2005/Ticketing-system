-- Durable snapshots of deleted tickets/comments and deleted account metadata.
-- Audit entries contain NO password hashes, tokens, or foreign keys to deleted rows.
-- Apply before deploying the new deletion handlers.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public."DeletionAudit" (
  "id" text PRIMARY KEY,
  "action" text NOT NULL,
  "actorId" text NOT NULL,
  "actorName" text NOT NULL,
  "actorRole" public."Role" NOT NULL,
  "subjectType" text NOT NULL,
  "subjectId" text NOT NULL,
  "subjectLabel" text NOT NULL,
  "details" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DeletionAudit_createdAt_idx" ON public."DeletionAudit" ("createdAt");
CREATE INDEX IF NOT EXISTS "DeletionAudit_subjectType_subjectId_idx"
  ON public."DeletionAudit" ("subjectType", "subjectId");
ALTER TABLE public."DeletionAudit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."DeletionAudit" FROM PUBLIC, anon, authenticated;

COMMIT;
