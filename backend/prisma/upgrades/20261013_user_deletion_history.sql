-- Apply to an existing EngineDesk database using its owner's connection.
-- This preserves every account, ticket and comment; it does NOT delete users.
-- It only allows history to survive later, explicitly confirmed account deletion.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public."Ticket" ALTER COLUMN "requesterId" DROP NOT NULL;
ALTER TABLE public."TicketComment" ALTER COLUMN "authorId" DROP NOT NULL;

ALTER TABLE public."Ticket" DROP CONSTRAINT IF EXISTS "Ticket_requesterId_fkey";
ALTER TABLE public."Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE public."TicketComment" DROP CONSTRAINT IF EXISTS "TicketComment_authorId_fkey";
ALTER TABLE public."TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES public."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
