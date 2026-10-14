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
- AI: OpenAI GPT-4.1 with Vision
- CI/CD: GitHub Actions
- Hosting: To be finalized

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
The initial frontend is a starter page; backend, upload, database, and AI
verification features still need implementation.

Only public configuration belongs in Vite variables prefixed with `VITE_`.
Keep OpenAI keys and database credentials on the backend, never in frontend code.

The frontend and backend will be deployed using the
team's selected hosting providers.

Changes merged into main should trigger automatic deployment.
