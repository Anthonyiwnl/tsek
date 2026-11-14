# TSEK

TSEK: Smart Document Verification and Requirements Checker

## Project Description

TSEK is a web application designed to help Filipino citizens organize and
check documentary requirements before applying for barangay services. Its
backend includes optional AI-assisted document analysis and text verification.

The backend validates extracted information and checks application
requirements. AI routes require `AI_VERIFY_ENABLED=true` and a server-side
provider key; the switch is off by default.

## Technology Stack

- Frontend: React.js
- Backend: Node.js
- API: REST API
- Database: PostgreSQL
- AI: OpenAI GPT-4.1 mini
- CI/CD: GitHub Actions
- Hosting: Vercel (frontend) and Render (backend)

## Team Members

| Name | Role |
|---|---|
| Francis Cromwell Tan | Full-stack Developer |
| Axel Josh Lorayna | AI Engineer |
| Ken John Maghari | Backend / API Developer |
| Hero Pedero | Frontend Developer |
| Anthony Saltat | DevOps Engineer |

## Development Workflow

1. Create a feature branch.
2. Implement the assigned task.
3. Run the relevant tests and checks.
4. Open a pull request into main.
5. Wait for the required checks to pass.
6. Review and merge the pull request.
7. Deploy the updated application.

## Environment Variables

Create `backend/.env` using `backend/.env.example` as a reference. The root `.env.example` is a reference template; backend scripts load their environment from the backend directory.

| Variable | Used by | Required | Purpose |
|---|---|---:|---|
| `DATABASE_URL` | Backend | Yes | Pooled PostgreSQL URL for API requests. |
| `DIRECT_DATABASE_URL` or `DATABASE_URL_UNPOOLED` | Backend scripts | For Neon migrations/seeds | Direct URL to the same database and branch as `DATABASE_URL`. |
| `NEON_AUTH_BASE_URL` | Backend | Yes for authenticated routes | Managed Auth issuer for the same Neon branch as the database. |
| `NEON_AUTH_JWKS_URL` | Backend | No | Overrides the JWKS URL derived from `NEON_AUTH_BASE_URL`. |
| `FRONTEND_URL` | Backend | No | Allowed browser origin; defaults to `http://localhost:5173`. |
| `PORT` | Backend | No | HTTP listen port; defaults to `3000`. |
| `VITE_NEON_AUTH_URL` | Frontend | Yes for sign-in | Public Managed Auth URL for the matching Neon branch. |
| `VITE_API_BASE_URL` | Frontend | Production only | Public origin of the deployed backend API; local Vite proxies `/api`. |
| `AI_VERIFY_ENABLED` | Backend | No | Set to exact `true` to enable AI verification and document analysis; defaults to `false`. |
| `OPENAI_API_KEY` | Backend | When AI is enabled | Server-side provider credential. Never put it in a `VITE_` variable. |
| `OPENAI_MODEL` | Backend | No | Model name; defaults to `gpt-4.1-mini`. |
| `OPENAI_TIMEOUT_MS` | Backend | No | Provider request timeout in milliseconds; defaults to `10000`. |

Keep database URLs and AI keys server-side. See [local setup](docs/LOCAL_INTEGRATION.md) for the full configuration steps.

Never commit API keys, database passwords, or other secrets.

## Deployment

Pull requests into `main` run installation, lint, build, security, and backend
test checks. A successful push to `main` deploys and smoke-tests staging
before production.

### Run the React frontend locally

The React + Vite application lives in `frontend/`. Use Node.js 24 LTS.

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. To validate the frontend:

```powershell
npm run lint
npm run build
```

The production build is generated in `frontend/dist/`.

### Deploy the frontend to Vercel

Connect the existing GitHub repository to the Vercel project named `tsek`.
Use these project settings:

- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`

For a manual preview deployment, run `vercel` from the `frontend` directory
and select the existing `tsek` project if it has already been created.
Use `./` as the code directory when running from inside `frontend`.
Run `vercel --prod` only when ready to publish to production.

For Git-triggered deployments, push the branch containing the frontend first.
Keep `main` as the production branch and merge reviewed changes into it.

Only public configuration belongs in Vite variables prefixed with `VITE_`.
Keep OpenAI keys and database credentials on the backend, never in frontend code.

The frontend deployment targets Vercel, and the backend deployment targets
Render. The authenticated React application-management page uses the backend
CRUD API and saves application records to PostgreSQL. Set
`VITE_NEON_AUTH_URL` to the Managed Auth URL for the same Neon branch and
`VITE_API_BASE_URL` to the backend origin when building for production. During
local development, Vite proxies `/api` requests to `http://localhost:3000`.
The Node.js API, PostgreSQL migrations, and sample data are in `backend/`.
Authenticated users can upload files to applications and run text-file
analysis when the backend AI switch and provider key are configured.

Changes merged into main should trigger automatic deployment.

See [CI/CD setup](docs/CI_CD.md) for the required GitHub environment,
secrets, variables, hosting settings, and verification steps.

## Run the Node.js backend locally

Use Node.js 24 LTS. From the repository root:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
# Configure the Neon URLs in .env before running database commands.
npm run db:migrate
npm run db:seed
npm run dev
```

The API listens on `http://localhost:3000` by default. `GET /api/document-types`
returns the active document catalogue; `GET /api/document-types/:id/requirements`
returns the requirements for a selected document type. Use a pooled Neon URL
for the running API and a direct URL for migrations; remote connections require
`sslmode=verify-full`. Keep database credentials on the backend.

See [backend setup and API contract](backend/README.md) and
[local integration and review](docs/LOCAL_INTEGRATION.md).

## Architecture and interface references

- [System architecture](docs/ARCHITECTURE.md) — runtime components and request flow.
- [Database schema](docs/DATABASE_SCHEMA.md) — current PostgreSQL entities and relationships.
- [API reference](docs/API_REFERENCE.md) — routes, authentication, examples, validation, and errors.

The diagrams and API reference describe the current `main` implementation,
including atomic document replacement and reanalysis. The migrations on `main`
run from `001_catalogue.sql` through `005_ai_request_budget.sql`. PR #172
proposes additional file-revision and analysis-generation fields; its migration
006 is not included in `main` while that work is being reconciled. See
[CI/CD setup](docs/CI_CD.md) for CI and release flow.

Run backend validation from the root with `npm run check --prefix backend`.
The CI workflow now detects `backend/package-lock.json` and runs backend checks.

