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

After deployment, sign in as HQ, open **Settings · Users → Operator credentials**,
and create an operator's company name, account holder, email and initial
password. Operators use the normal login page and can add staff individually
or via **Bulk add staff**. No shared default operator password is seeded.
Passwords are bcrypt hashes in `User`; `Operator` references that login account.
Existing staff ownership can remain empty for company staff. HQ can select an
operator when adding staff manually or importing CSV accounts.

Download the template in Settings, populate unique passwords (at least twelve
characters, at most 72 UTF-8 bytes), use STAFF / SU or BRANCH_MANAGER / SM, and
use the listed branch codes. The optional zone column must match the branch.
Uploads accept UTF-8 CSV under 500 KB with up to 500 staff rows. Use **Validate &
preview** before **Add staff**. Invalid roles, branches, zones, duplicate emails,
and existing accounts reject the entire batch; no accounts are overwritten.
Passwords are never returned in previews or staff directory responses. Staff
can change their initial password under Profile after signing in.

Managers can manage staff and tickets in their assigned zone; a manager linked
to an operator is additionally restricted to that operator's staff/tickets.
Operators manage their own staff and tickets; HQ retains system-wide access.
Technicians see tickets they raised or are assigned and submit only for their
account's branch. Technicians may resume, wait or resolve active tickets;
managers close resolved tickets or escalate to HQ. Waiting pauses the SLA
without erasing a breach that occurred before the pause. Resuming extends the
original deadlines by the pause duration. Historical NEW/ACKNOWLEDGED tickets
become IN_PROGRESS; existing WAITING tickets begin pausing from their last saved
update because older waiting intervals were not recorded.

The SQL and schema are supplied in the repository. Applying them to your live
Supabase project requires its database connection; repository updates alone do
not confirm a live database upgrade. Render services configured for auto-deploy
will run the Docker schema setup when this change reaches their deployed branch.
