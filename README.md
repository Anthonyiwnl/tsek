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

Create a local .env file using .env.example as a reference.

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
The frontend includes the Figma-based prototype and a working catalogue-backed checklist.
The `#/applications` route connects Neon sign-in and saved applications, draft editing/deletion, uploads, and analysis results
to the backend API. See [workflow setup and verification](docs/HERO_APPLICATION_WORKFLOWS.md).

Only public configuration belongs in Vite variables prefixed with `VITE_`.
Keep OpenAI keys and database credentials on the backend, never in frontend code.

The frontend deployment targets Vercel, and the backend deployment targets
Render. The application workflow requires the application and analysis backend
endpoints to be deployed and configured before live acceptance.

Changes merged into main should trigger automatic deployment.

### Database catalogue integration (issue #10)

New Application reads `GET /api/document-types`, then
`GET /api/document-types/:id/requirements` using the backend's `{ data: ... }`
contract. It never substitutes fixtures on failure. Required and conditional
items retain the database's `is_required` flag. Loading, empty catalogue,
empty requirements, error/retry, and a 15-second timeout are supported.
Changing service clears previously selected files.

Locally, run the catalogue backend from PR #4 on port 3000, then run
`npm run dev` in `frontend/`. Vite proxies catalogue requests to
`http://127.0.0.1:3000`; override `BACKEND_PROXY_TARGET` in a local env file
if needed. The backend needs a configured, migrated and seeded database.

On Vercel, `frontend/vercel.json` forwards the two catalogue routes to
`https://tsek-fl10.onrender.com`. Keep `VITE_CATALOGUE_ENDPOINT` unset or set to
`/api/document-types` to use this same-origin route. This avoids cross-origin
browser requests without broadening backend CORS. Other hosts can set a full
public endpoint URL, with matching backend CORS. Database credentials belong
only on the backend. `VITE_SERVICES_ENDPOINT` is no longer used. The unused sample API handler has been removed.

Run `npm test`, `npm run lint`, and `npm run build` in `frontend/`.
Automated tests use synthetic responses. Live preview verification on 27 October
2026 confirmed all three database catalogue types, each with three requirements,
through Vercel and in the browser. See [verification evidence](docs/CATALOGUE_VERIFICATION.md).
Production promotion and teammate approval remain pending. A controlled database
edit demonstration remains shared acceptance with Ken/Francis; Hero verifies
the resulting UI update. No database writes were performed. See the verification
record for the updated preview and frontend review fixes.

Files remain local (PDF/JPEG/PNG, nonempty, up to 5 MB); no document bytes or
purpose text are uploaded. Authentication, AI verification, and application
persistence remain outside this change.

### Figma design source

The UI was recovered from the user-provided `Smart Document Verification App (Copy).make`
archive, source commit `f3e2cbb0cbf98cac79bcd26eabce47e49052fcc7`.
`src/App.tsx` contains the landing, citizen, and administrator design previews;
`src/DesignUI.tsx` contains shared visual components; `src/NewApplication.tsx`
contains the API-backed five-step checklist. Global design styles live in
`src/index.css`, with functional checklist additions in `src/App.css`.
The original checkmark image is restored from the archive's Git LFS object.
No Figma-only runtime, Tailwind build plugin, or temporary asset URLs are required.

Account fields are disabled in the demo. Citizen and administrator records are
illustrative, and administrator edits/decisions are not persisted. The new application
wizard uses the backend catalogue endpoints and local file validation; it does not simulate
successful AI extraction. Leave the checklist or refresh to clear selected files.

Validation: `npm run lint`, `npm test` (catalogue loader and response states),
and `npm run build`, all from `frontend/`.

See [CI/CD setup](docs/CI_CD.md) for the required GitHub environment,
secrets, variables, hosting settings, and verification steps.
