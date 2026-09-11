# EngineDesk — Engineering Service Management

A committee-ready demonstration of a branch-to-HQ ticketing system for an engineering company. It captures incidents and service requests, applies priority-based SLA/SLG targets, records updates, and provides controlled operational visibility.

## Demo access

| Scope | Email | Password |
| --- | --- | --- |
| Staff, Branch 1 | `testuser1branch1@test.com` | `password123` |
| Branch 1 manager | `managerbranch1@test.com` | `admin123` |
| HQ control | `hq@test.com` | `admin123` |

Each of the three branches has five seeded staff accounts: `testuser1branch1@test.com` through `testuser5branch3@test.com`. Staff use `password123`; managers and HQ use `admin123`.

## Access rules

- Staff can create, view, and comment only on their own tickets.
- Each branch manager sees and progresses only tickets from their branch.
- HQ has a cross-branch register, branch load, and SLA-risk view.
- Critical, high, medium, and low tickets have acknowledgement/resolution targets of 1/4, 4/12, 8/24, and 24/72 hours respectively.

## Local run

1. Set `DATABASE_URL` and a strong `JWT_SECRET` in `backend/.env` (copy `backend/.env.example`).
2. Run `npm install` in the root, `backend`, and `frontend` directories.
3. Run `cd backend && npx prisma db push && node seed.js`.
4. Run `npm run build --prefix frontend`, then `node start.js` from the project root.

For a Render + Supabase demo, use the Dockerfile. Configure `DATABASE_URL`, `JWT_SECRET`, and optionally `CORS_ORIGINS`; the container prepares the schema and seeded demo data at startup.
