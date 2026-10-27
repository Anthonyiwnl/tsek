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
The frontend includes the Figma-based prototype and a working sample-service checklist.
Real authentication, backend uploads, database storage, and AI verification still need implementation.

Only public configuration belongs in Vite variables prefixed with `VITE_`.
Keep OpenAI keys and database credentials on the backend, never in frontend code.

The frontend deployment targets Vercel, and the backend deployment targets
Render. The frontend prototype and sample-service checklist are implemented;
backend uploads, database storage, and AI verification remain pending.

Changes merged into main should trigger automatic deployment.

### Frontend demo and sample API

Run `npm run dev` from `frontend/`. The app fetches `GET /api/services`;
Vite serves the same handler locally that Vercel deploys as a serverless function.
Responses are `{ source: "sample", services: [{ id, name, description, requirements: [{ id, name }] }] }`.
These are illustrative fixtures, not database records or official requirements.

Open **Get started → Continue to demo → New application**. In local development,
expand **Development: test API states** to select success,
slow loading (4 seconds), empty, or server error. Empty/error responses can also
be exercised with `/api/services?scenario=empty` and `?scenario=error`.
Non-GET requests return 405. Fetches time out after 15 seconds and errors offer retry.

To connect the team's backend, set `VITE_SERVICES_ENDPOINT` before building
(e.g. `https://your-backend.example/api/services`). It must return the response
shape above and allow the frontend origin through CORS if on a different domain.
Only put public endpoint URLs in Vite configuration; never secrets.

Files are selected locally, checked for PDF/JPEG/PNG MIME type, nonzero size,
and a maximum size of 5 MB. No document bytes or purpose text are uploaded or stored.
The review checks file presence only; it does not verify contents or authenticity.
Selections reset on refresh or service change. Real uploads, AI verification,
database integration, and official requirement validation are future backend work.

For the currently linked Vercel project, deploy from `frontend/` with
`vercel deploy --prod`; after deployment confirm `tsek-app.vercel.app` points
to the new production deployment. Git-based deployment still requires repository access.

### Figma design source

The citizen dashboard and document checklist now follow the approved
[combined Figma concept](https://www.figma.com/design/TP7VAonK573U6vjm5bxJEt),
including the refined T/check logo across shared branding. See
[Figma UI implementation](docs/FIGMA_UI.md) for source nodes, responsive
behavior, and differences between the design sample and the working demo.

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
wizard uses the actual sample endpoint and local file validation; it does not simulate
successful AI extraction. Leave the checklist or refresh to clear selected files.

Validation: `npm run lint`, `npm test` (sample API contract and response states),
and `npm run build`, all from `frontend/`.

See [CI/CD setup](docs/CI_CD.md) for the required GitHub environment,
secrets, variables, hosting settings, and verification steps.
