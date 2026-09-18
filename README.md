# EngineDesk — Engineering Service Management

A responsive engineering operations workspace with live reporting, six service systems, and branch-scoped access.

- Resolved/unresolved trends, followed by Total Tickets, Total Unresolved Tickets, Total Resolved Tickets, Total Missed SLA and Total Within SLA.
- Every metric opens HVAC, CCTV, Fire Alarm, BAS, Gas System and Elevator, then the matching tickets.
- This month, last month, this year, all time and inclusive custom dates use Malaysia time (UTC+8), based on ticket creation dates.
- Right-side filters cover West MY / East MY and state-based branches, including Pahang, Sabah and Sarawak.
- Staff see **only tickets they submitted**, across all destination branches. Branch managers see **all tickets assigned to their own branch**. HQ sees all tickets.
- Any authenticated user can submit to any branch. A submission to another branch remains visible to its requester, the destination branch’s managers and HQ. Other staff cannot view it.
- Only managers and HQ change workflow; staff cannot see internal notes. Server-side scope checks apply to lists, reporting, updates and comments.
- SLA reporting measures resolution: unresolved tickets are checked against the current time, completed tickets against their resolution time. Late resolutions remain missed. Closed tickets count as resolved. Reopening clears completion times and retains the original deadline.

## Local run

1. Configure `DATABASE_URL` and a strong `JWT_SECRET` in `backend/.env` (see `.env.example`).
2. Install dependencies with `npm ci`, `npm ci --prefix backend`, and `npm ci --prefix frontend`.
3. Prepare a **development/demo database** with `cd backend && npx prisma db push && node seed.js`.
4. Run `npm run build --prefix frontend`, then `node start.js` at the repository root. Open `http://localhost:8080`.

The historical migration files belong to the previous receipt application. The current demo uses `prisma db push` consistently with its Docker startup; do not apply the legacy migrations to an EngineDesk database. Back up existing databases before schema administration.

## Demo access

| Role | Email | Password |
| --- | --- | --- |
| Staff, Selangor | `testuser1branch1@test.com` | `password123` |
| Selangor manager | `managerbranch1@test.com` | `admin123` |
| HQ | `hq@test.com` | `admin123` |

The seed provides sixteen state/federal-territory branches, five staff accounts and one manager for each of the original three branches, and sixty sample tickets when the ticket table is empty. Existing account passwords and roles are preserved. The original BR1–BR3 identities become Selangor, Johor and Penang without changing their IDs. Sabah, Sarawak and Labuan belong to East MY; other branches belong to West MY. Existing tickets using retired service categories remain accessible in the full register.

## Verification

- `npm test --prefix backend`: API regression checks for authorization, scope overrides, cross-branch submission, internal notes, validation, Malaysia date boundaries, SLA calculation and workflow transitions.
- `npm run build --prefix frontend`: production build.
- `npm run lint --prefix frontend`: lint checks (legacy inactive receipt components retain existing warnings).

Staff have a personal ticket tracker with progress steps, ticket history and recent updates, refreshed every 15 seconds. Manager/HQ reporting refreshes every minute and on changes; manual refresh is available. The sidebar and login offer a persistent light/dark purple-and-blue theme switch. The graph groups ticket creation dates by their current resolved/unresolved state, rather than presenting a historical backlog snapshot.
