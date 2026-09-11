# ADR 002 — JWT bearer tokens + role checks

**Context.** Stateless API; separate admin & user areas.

**Decision.** JWT signed with `JWT_SECRET`, bcrypt(cost 12) password hashing, `role` claim (`USER`/`ADMIN`). Every admin route goes through `adminAuth` middleware — frontend route guards are UX-only.

**Consequences.** Simple to reason about; no server session state. Refresh tokens were intentionally omitted (scope/valence) — tokens are short-lived (`JWT_EXPIRES_IN`, default 7d).
