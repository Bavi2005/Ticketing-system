# EngineDesk — Engineering Service Management

A responsive engineering operations workspace with live reporting, six service systems, and branch-scoped access.

- Five metric cards retain Total Tickets, Unresolved, Resolved, Missed SLA and Within SLA.
- SLA Health and Resolution Health sit on the left of the dashboard, with compact period/New ticket controls above the metrics. Resolution Health is resolved (including closed) ÷ total tickets, for the same period and scope.
- Every metric opens HVAC, CCTV, Fire Alarm, BAS, Gas System and Elevator, then the matching tickets.
- Malaysia reporting dates (UTC+8), zone and branch filters apply consistently to metrics and both health cards.
- SU / technicians see tickets they raised or are assigned. Their submission branch/zone is fixed to their account. SM / managers manage tickets and staff in their assigned zone; SO / HQ controls the full system.
- Tickets start IN_PROGRESS. Technicians can choose WAITING or RESOLVED, and resume work. Waiting pauses SLA clocks; managers formally close resolved tickets or assign/escalate to HQ. Retired NEW/ACKNOWLEDGED statuses remain in the database enum solely for compatibility.
- Settings · Users supports staff creation and role/zone/branch edits, plus validated CSV previews and atomic bulk imports of up to 500 accounts. HQ creates dedicated operator logins; each operator manages its own staff and tickets.
- All permissions are checked by the backend, including operator ownership. Passwords are bcrypt hashes and are excluded from API account responses.
- SLA reporting checks active tickets against now, waiting tickets against the pause start and completed tickets against resolution time. Late resolutions remain missed. Closed tickets count as resolved. Reopening clears completion times and preserves elapsed work.
- See [DEPLOYMENT.md](DEPLOYMENT.md#operator-accounts-and-staff-upgrade-october-2026) for the additive Supabase/Postgres upgrade and operator setup.

## Local run

1. Configure `DATABASE_URL` and a strong `JWT_SECRET` in `backend/.env` (see `.env.example`).
2. Install dependencies with `npm ci`, `npm ci --prefix backend`, and `npm ci --prefix frontend`.
3. Prepare a **development/demo database** with `cd backend && npx prisma db push && node seed.js`.
4. Run `npm run build --prefix frontend`, then `node start.js` at the repository root. Open `http://localhost:8080`.

The historical migration files belong to the previous receipt application. The current demo uses `prisma db push` consistently with its Docker startup; do not apply the legacy migrations to an EngineDesk database. Back up existing databases before schema administration.

## Demo access

| Role             | Email                     | Password      |
| ---------------- | ------------------------- | ------------- |
| Staff demo 1     | `testuser1@test.com`      | `password123` |
| Staff demo 2     | `testuser2@test.com`      | `password123` |
| Staff demo 3     | `testuser3@test.com`      | `password123` |
| Staff demo 4     | `testuser4@test.com`      | `password123` |
| Staff demo 5     | `testuser5@test.com`      | `password123` |
| Selangor manager | `managerbranch1@test.com` | `admin123`    |
| HQ               | `hq@test.com`             | `admin123`    |

The seed provides sixteen state/federal-territory branches, five staff accounts, one manager for each of the original three branches, and sixty sample tickets when the ticket table is empty. The five staff demo emails are branch-free (`testuser1@test.com` through `testuser5@test.com`), and older `testuser1branch1@test.com`-style demo accounts are renamed or archived on reseed. Existing account passwords and roles are preserved. The original BR1–BR3 identities become Selangor, Johor and Penang without changing their IDs. Sabah, Sarawak and Labuan belong to East MY; other branches belong to West MY. Existing tickets using retired service categories remain accessible in the full register.

## Verification

- `npm test --prefix backend`: API regression checks for authorization, scope overrides, fixed staff submission scope, zone/role/operator restrictions, CSV validation and atomic imports, password hashing, internal notes, Malaysia date boundaries, paused SLA calculation and workflow transitions.
- `npm run build --prefix frontend`: production build.
- `npm run lint --prefix frontend`: lint checks (legacy inactive receipt components retain existing warnings).

Staff have a personal ticket tracker with progress steps, ticket history and recent updates, refreshed every 15 seconds. Manager/HQ reporting refreshes every minute and on changes; manual refresh is available. The graph groups ticket creation dates by their current resolved/unresolved state, rather than presenting a historical backlog snapshot.
