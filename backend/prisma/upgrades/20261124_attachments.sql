-- Ticket and comment file attachments (metadata only; file bytes live in storage).
-- Additive and repeatable: safe to run more than once. Deletes no data.
-- Apply in the Supabase SQL Editor (or with the owner's connection) BEFORE
-- deploying code that includes `attachments` in Prisma queries.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS public."Attachment" (
  "id" text PRIMARY KEY,
  "filename" text NOT NULL,
  "originalName" text NOT NULL,
  "mimeType" text NOT NULL,
  "size" integer NOT NULL,
  "ticketId" text,
  "commentId" text,
  "uploaderId" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Attachment_ticketId_idx" ON public."Attachment" ("ticketId");
CREATE INDEX IF NOT EXISTS "Attachment_commentId_idx" ON public."Attachment" ("commentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attachment_ticketId_fkey') THEN
    ALTER TABLE public."Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES public."Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Attachment_commentId_fkey') THEN
    ALTER TABLE public."Attachment" ADD CONSTRAINT "Attachment_commentId_fkey"
      FOREIGN KEY ("commentId") REFERENCES public."TicketComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Same lockdown as the other tables: only the Express backend touches this.
ALTER TABLE public."Attachment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."Attachment" FROM PUBLIC, anon, authenticated;

COMMIT;
