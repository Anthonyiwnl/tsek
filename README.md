# TSEK

TSEK: Smart Document Verification and Requirements Checker

## Project Description

TSEK is an AI-powered web application designed to help Filipino
citizens verify and organize their documentary requirements
before applying for barangay services.

The application uses AI to extract information from uploaded
documents while the backend validates the extracted information
and checks the application's requirements.

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

Never commit API keys, database passwords, or other secrets.

## Deployment

Pull requests into `main` run installation, lint, build, and backend test
checks. A successful push to `main` triggers the configured production
deployments and verifies the configured public URLs.

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
The Node.js catalogue API, PostgreSQL migrations, and sample data are in
`backend/`. Document uploads and AI verification are not connected yet.

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

Run backend validation from the root with `npm run check --prefix backend`.
The CI workflow now detects `backend/package-lock.json` and runs backend checks.
