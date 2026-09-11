# ADR 003 — Idempotent receipt approval

**Context.** Business rule: approved receipt → exactly one voucher. Retries and double-clicks must not duplicate.

**Decision.** Approval runs in a single Prisma `$transaction` that re-reads receipt status inside the transaction and updates + creates the voucher atomically. `Voucher.receiptId` is `UNIQUE` at the DB level as a hard backstop.

**Verified by test.** Three concurrent approvals return 200 and yield exactly one voucher.
