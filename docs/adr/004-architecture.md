# ADR 004 — Single-port monolith + proxy, layered backend

**Context.** Assessment needs a simple, demonstrable full-stack app.

**Decision.** One entry point: `proxy.js` serves the built SPA and proxies `/api`,`/uploads` to Express on :5000. Backend layers: routes → middleware (auth, validate, rate-limit) → controllers → Prisma → PostgreSQL.

**Rejected.** Microservices, GraphQL, Redis — no requirement justifies them.
