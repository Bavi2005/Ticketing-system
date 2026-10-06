# Deploy runbook

## Production — Render (Docker) + Supabase Postgres

The app ships as a single container that runs `proxy.js` (public :8080) and the
Express API (:5000, internal) together. The frontend is built into the image at
build time; the database is the managed Postgres in Supabase.

1. In Render create a **Web Service** from this repo. It auto-detects the
   root `Dockerfile`.
2. Set the environment variables (see `backend/.env.example`), most importantly
   `DATABASE_URL` (Supabase connection string) and `JWT_SECRET`.
3. Deploy. The container runs `node start.js`.
4. Seed demo data once if needed (Render → service → Shell):
   ```bash
   cd backend && node seed.js
   ```

The demo container runs `prisma db push` and the idempotent seed at startup.
The legacy migration files describe the previous receipt application, not the
current ticketing schema. Back up existing databases before schema changes.
Seeding preserves existing account credentials and adds sample tickets only to an empty ticket table.

## Local — Docker Compose (self-contained)

Brings up Postgres + the app, prepares the ticketing schema and seeds demo data:

```bash
docker compose up --build   # app on http://localhost:8080
```

## Local — without Docker

```bash
cd backend
cp .env.example .env        # fill DATABASE_URL + JWT_SECRET
npm install
npx prisma db push
node seed.js
node src/server.js          # API on :5000

cd ../frontend
npm install
npm run build               # produces dist/

cd ..
node proxy.js               # app on :8080
```

## Notes

- CORS origins default to `CLIENT_URL`; override with `CORS_ORIGINS`
  (comma-separated) when the frontend and API live on different origins.
- Receipt files are stored on disk under `backend/uploads`. For production this
  should move to object storage (S3 / Supabase Storage / Cloudflare R2).
## Operator accounts and staff upgrade (October 2026)

For an existing EngineDesk database, run the additive SQL in
`backend/prisma/upgrades/20261006_operator_staff.sql` with the database owner's
connection or Supabase SQL Editor. It adds the `Operator` table, account
ownership/zone fields, and waiting/escalation timestamps without dropping data.
For a fresh database, use `npx prisma db push` and the seed. The Docker startup
also synchronizes the schema and backfills zones and the simplified lifecycle.
Do not apply the historical receipt migrations.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/prisma/upgrades/20261006_operator_staff.sql
```

Before deployment, set `OPERATOR_EMAIL` and `OPERATOR_PASSWORD` in Render.
Use a dedicated email not already assigned to another role and a unique password
of at least twelve characters and at most 72 UTF-8 bytes. Optionally set
`OPERATOR_NAME` and `OPERATOR_COMPANY`. Docker startup runs the seed to create
this separate operator account; reseeding preserves its password and company
name. There is no default operator password. For a running environment, run
`cd backend && node seed.js` after setting the variables.

Use the shared login page, then open **Access control** to
create HQ, manager, and technician credentials or edit their role/region/site.
HQ can edit technician and site manager access; site managers can edit their own
technicians and assign existing technicians to their site. Only operators register
new accounts or bulk-import credentials. The API enforces this rule from the
database role, irrespective of client controls or JWT role claims.

Download the CSV template in Access control. Use HQ_ADMIN / HQ,
BRANCH_MANAGER / SM, or STAFF / SU. HQ rows leave site and region empty; other
rows use a valid site code and matching region. Uploads accept UTF-8 CSV under
500 KB with up to 500 accounts. Use **Validate & preview** before importing.
Invalid roles, sites, regions, duplicate emails, and existing accounts reject
the whole batch. Passwords are hashed and never returned in previews or the
directory. Users can change their own password under Profile.

Operators and HQ have platform-wide ticket oversight. Site managers see tickets
at their site plus tickets raised by or assigned to their current technicians.
The site-manager **Add technician to my site** action moves an existing STAFF
account to the manager's own site, preserving the password, role, ownership,
and access-enabled flag. It does not create a new account or rewrite historical
ticket site IDs. Destination site and technician role are enforced by the API.

Docker startup runs `prisma db push` before the seed, adding `User.accessEnabled`
with a default of true. For a manual existing-database upgrade, the additive SQL
also adds this field; run the seed afterwards to populate the catalogue. Seeding
renames the original BR1–BR16 demo sites in the supplied order while keeping
foreign-key IDs, adds BR17–BR26, and sets current user regions to their site's
region. Existing account passwords and disabled-access flags are preserved.

The shared `/api/reports/public` endpoint is intentionally available without
login. It exposes opening/closure counts and six recent anonymized outcome
timelines, never titles, descriptions, names, emails, or comments. Formal
CLOSED timestamps drive closure graphs; RESOLVED is shown separately in recent
outcomes. Because reopening clears closure timestamps in this model, the report
reflects current recorded events rather than a permanent audit event log.

Technicians see tickets they raised or are assigned and submit only for their
account's site. Technicians may resume, wait or resolve active tickets;
managers close resolved tickets or escalate to HQ. Waiting pauses the SLA
without erasing a breach that occurred before the pause. Resuming extends the
original deadlines by the pause duration. Historical NEW/ACKNOWLEDGED tickets
become IN_PROGRESS; existing WAITING tickets begin pausing from their last saved
update because older waiting intervals were not recorded.

The SQL and schema are supplied in the repository. Applying them to your live
Supabase project requires its database connection; repository updates alone do
not confirm a live database upgrade. Render services configured for auto-deploy
will run the Docker schema setup when this change reaches their deployed branch.
