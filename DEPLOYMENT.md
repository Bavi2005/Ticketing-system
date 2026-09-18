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