# ADR 001 — PostgreSQL + Prisma

**Context.** The assessment requires PostgreSQL. We need typed schema, migrations, transactions.

**Decision.** PostgreSQL as the single source of truth; Prisma ORM for schema + migrations + typed client.

**Consequences.** Migrations are versioned in Git and applied via `prisma migrate deploy` in CI/production. Business invariants (e.g. `Voucher.code UNIQUE`, `Voucher.receiptId UNIQUE`) are enforced by the database, not just application code.
