-- EngineDesk uses a private Express/Prisma API with JWT roles.
-- Browser clients must NOT query these PostgreSQL tables via Supabase Data API.
-- Apply ONCE in the Supabase SQL Editor, after confirming this is the right project.
-- Prisma's database owner normally bypasses RLS; if using FORCE RLS or a
-- restricted DB role, verify backend access before applying.
BEGIN;

ALTER TABLE public."Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Operator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TicketComment" ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies are created deliberately: all operations
-- must go through the authenticated Express backend and its role checks.
REVOKE ALL PRIVILEGES ON TABLE
  public."Branch",
  public."User",
  public."Operator",
  public."Ticket",
  public."TicketComment"
FROM anon, authenticated;

COMMIT;

-- Verify: all rows should show rowsecurity = true.
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('Branch', 'User', 'Operator', 'Ticket', 'TicketComment')
ORDER BY tablename;
