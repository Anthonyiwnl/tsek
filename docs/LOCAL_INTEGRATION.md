# Local integration and DevOps review

The repository contains two independent Node.js packages:

- `frontend/`: the React/Vite UI, Neon Auth sign-in, and application management.
- `backend/`: the Node.js/Express catalogue API and PostgreSQL migrations.

Use Node.js 24 LTS. Run commands below from the repository root unless specified otherwise.

## Validate before review

```powershell
npm ci --prefix frontend
npm ci --prefix backend
npm run lint --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
npm run check --prefix backend
```

The backend tests use embedded PostgreSQL (PGlite) and temporary HTTP servers. They validate migrations, seed data, queries, HTTP responses and error handling without changing Neon. They include application CRUD, invalid input, and ownership isolation. The frontend has lint, TypeScript, production-build, and API-client tests. These do not replace a browser test against a configured Neon Auth and API environment.

## Run both locally

Configure `backend/.env` from `backend/.env.example`; do not overwrite an existing `.env`. Set a Neon pooled `DATABASE_URL`, direct `DIRECT_DATABASE_URL`, `NEON_AUTH_BASE_URL` for that same Neon branch, and `FRONTEND_URL=http://localhost:5173`. Both database URLs must refer to the same development branch/database and use `sslmode=verify-full`. In `frontend/.env.local`, set `VITE_NEON_AUTH_URL` to that branch's public Neon Auth URL. Do not commit either env file.

In terminal 1:

```powershell
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
npm run dev --prefix backend
```

In terminal 2:

```powershell
npm run dev --prefix frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://localhost:5173` for the homepage. The strict port keeps the frontend origin consistent with the API's CORS configuration. The API runs at `http://localhost:3000` by default, and Vite proxies `/api` requests to it. Verify it with:

```powershell
Invoke-RestMethod http://localhost:3000/health/ready
$types = Invoke-RestMethod http://localhost:3000/api/document-types
$types.data
$typeId = $types.data[0].id
Invoke-RestMethod "http://localhost:3000/api/document-types/$typeId/requirements"
```

Sign in or create an account in the React UI, then open **My applications**. The page loads the authenticated user's applications and the PostgreSQL document catalogue. Create, view, edit, and delete draft records there; reload the page to confirm persisted changes. Use two separate accounts to confirm each sees only their own records. The API returns another user's record as not-found. Files remain local to the browser and are not uploaded or stored.

For production, set Vercel's `VITE_NEON_AUTH_URL` to the correct branch Auth URL and `VITE_API_BASE_URL` to the Render API origin, then redeploy. Set Render's `FRONTEND_URL` to the exact deployed frontend origin. Never put database credentials in React or `VITE_` variables.

## Branch and review workflow

The application CRUD integration is on `backend/applications-crud`. Its pull
request may target `backend/document-types-api` while that catalogue prerequisite
is still under review. Keep that stacked base to avoid duplicating the
prerequisite's changes in the diff. After the catalogue pull request merges into
`main`, retarget this pull request to `main` if GitHub does not update it
automatically. Review the React integration, authenticated API, database
migrations, tests, and workflow changes together. Ask the frontend and DevOps
owners to review the portions they own; do not merge until required reviews and
CI checks pass.

Avoid direct pushes to `main` and force-pushing shared feature branches. The
workflow runs frontend and backend validation on pull requests. Production
deployment and live behavior against Neon Auth/PostgreSQL must still be verified
after merge; a green component test run alone is not proof of deployment.
