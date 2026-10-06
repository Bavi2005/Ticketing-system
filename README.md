# EngineDesk — Engineering Service Management

A responsive engineering operations workspace with live reporting, six service systems, and branch-scoped access.

- Five metric cards retain Total Tickets, Unresolved, Resolved, Missed SLA and Within SLA.
- Operational Scope fills the far-right dashboard panel on desktop and appears only on the overview. SLA Health and Resolution Health sit beside each other in the main dashboard, with compact period/New ticket controls above the five metrics. On smaller screens the scope panel stacks after the main content while both health cards remain adjacent. Resolution Health is resolved (including closed) ÷ total tickets, for the same period and scope.
- Every metric opens HVAC, CCTV, Fire Alarm, BAS, Gas System and Elevator, then the matching tickets.
- Malaysia reporting dates (UTC+8), zone and branch filters apply consistently to metrics and both health cards.
- Technicians see tickets they raised or are assigned. Site managers see tickets at their site and tickets raised by or assigned to technicians currently under them. HQ and operators have platform-wide oversight.
- Operators register HQ, managers, and technicians individually or through validated CSV bulk imports. HQ edits technician and manager access. Site managers edit their own technicians and can add any existing technician to their site. Only operators create new login accounts or reset another user's password.
- Access control is a single searchable list. Edit access, registration, bulk import, and site assignment open ticket-style dialogs with a blurred backdrop. HQ and site managers enter Access control through the profile menu between Profile details and Log out.
- Login access can be enabled or disabled. The API checks the current database role and access flag on every authenticated request, including existing sessions.
- One sign-in page serves every role. Reporting is available in every workspace and through **View public report** before login. Public reports show zero-filled year/month and last-seven-day opening/closure event charts and recent ticket outcomes, without identities or internal notes.
- The supplied catalogue has 26 sites across CENTRAL, NORTHERN, SOUTHERN, and East Coast (EC). All visible navigation, filters, ticket forms, and access editors use region/site terminology. Existing database/API field names are retained for compatibility.
- SLA reporting checks active tickets against now, waiting tickets against the pause start and completed tickets against resolution time. Late resolutions remain missed. Closed tickets count as resolved. Reopening clears completion times and preserves elapsed work.
- See [DEPLOYMENT.md](DEPLOYMENT.md#operator-accounts-and-staff-upgrade-october-2026) for the additive Supabase/Postgres upgrade and operator setup.

## Operator system control

Sign in with your operator account on the shared login page to enter the operator dashboard. Configure `OPERATOR_EMAIL` and `OPERATOR_PASSWORD` before running the seed (Render Docker startup runs it automatically). Optional `OPERATOR_NAME` and `OPERATOR_COMPANY` label the account. There is no shared default operator password. Use a dedicated email not already assigned to HQ or staff; reseeding preserves an existing operator's password.

The operator overview shows platform-wide workforce counts, ticket health for the selected reporting scope, and a PostgreSQL readiness check refreshed every minute. WhatsApp, email, calendar, AI, subscription, and payment-provider integrations are not connected in this repository; the dashboard explicitly labels them unconfigured rather than claiming live health or paid invoices.

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

The seed maintains the 26-site catalogue from `backend/src/utils/sites.js`. Existing BR1–BR16 site IDs are retained and renamed to the supplied catalogue in its listed order; BR17–BR26 are added. Ticket/user foreign keys remain intact. Users attached to a site receive its current region. Existing account passwords and access flags remain unchanged on reseed. The five original technician demo logins and three original manager demo logins remain available, alongside one new manager and one new technician test account per site. See [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md) for the full temporary credential list. Sample tickets are added only when the ticket table is empty.

## Verification

- `npm test --prefix backend`: API regression checks for authorization, scope overrides, fixed staff submission scope, zone/role/operator restrictions, CSV validation and atomic imports, password hashing, internal notes, Malaysia date boundaries, paused SLA calculation and workflow transitions.
- `npm run build --prefix frontend`: production build.
- `npm run lint --prefix frontend`: lint checks (legacy inactive receipt components retain existing warnings).

Staff have a personal ticket tracker with progress steps, ticket history and recent updates, refreshed every 15 seconds. Manager/HQ reporting refreshes every minute and on changes; manual refresh is available. The graph groups ticket creation dates by their current resolved/unresolved state, rather than presenting a historical backlog snapshot.
