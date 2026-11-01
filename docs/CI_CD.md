# TSEK CI/CD Setup

## Pipeline behavior

Two workflows split the work so pull requests only list checks that actually
run on them (#93):

| Workflow | File | Runs on | Jobs |
|---|---|---|---|
| Pull request checks | `.github/workflows/ci.yml` | Pull requests into `main`, manual runs, and called by the next workflow | `Install, lint, build, and test` (the required check) |
| CI and deployment | `.github/workflows/deploy-main.yml` | Every push to `main` | `Checks` (calls `ci.yml`) → `Staging` → `Production` (both call `deploy.yml`) |

For each application component that is present, the workflow performs:

- a clean dependency installation from its lockfile;
- frontend lint and production build checks;
- backend lint, build, and test scripts when those scripts exist; and
- production deployment only after all checks pass on `main`.

The component detection is temporary support for the Week 1 integration
period. The frontend and backend jobs become active as soon as their
`package-lock.json` files are merged.

## GitHub production environment

In the repository, open **Settings > Environments** and create an environment
named `production`. Add these environment secrets:

| Secret | Purpose |
|---|---|
| `VERCEL_DEPLOY_HOOK_URL` | Secret Vercel deploy hook for the `main` branch |
| `RENDER_DEPLOY_HOOK_URL` | Secret Render deploy hook for the backend service |

Deploy hook URLs grant permission to trigger deployments. Never put them in
source code, workflow text, issue comments, or logs.

Add these environment variables for post-deployment verification:

| Variable | Example purpose |
|---|---|
| `FRONTEND_URL` | Public Vercel production URL |
| `BACKEND_HEALTHCHECK_URL` | Public Render health endpoint, such as `/health` |
| `DATABASE_CHECK_URL` | Public database-backed API endpoint, such as `/api/document-types` |

The deployment job reports a skipped provider when its hook has not been
configured. The verification job similarly reports any missing public URL.
This lets the CI checks be merged before the hosting projects are available
without exposing placeholder credentials.

## Vercel frontend

1. Import the GitHub repository into Vercel.
2. Set the production branch to `main`.
3. Set the root directory to `frontend`.
4. Select the Vite framework preset.
5. Use `npm ci` as the install command, `npm run build` as the build command,
   and `dist` as the output directory.
6. Create a deploy hook for `main` and save it as the
   `VERCEL_DEPLOY_HOOK_URL` GitHub environment secret.
7. Save the production URL as the `FRONTEND_URL` GitHub environment variable.

## Render backend

Complete these steps when the backend application has been merged:

1. Create a Render web service from the GitHub repository and select `main`.
2. Set the root directory to `backend`.
3. Use the backend's documented build and start commands.
4. Configure `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `JWT_SECRET`,
   and `FRONTEND_URL` in Render. Set `OPENAI_MODEL` to `gpt-4.1-mini`.
5. Keep Render auto-deploy disabled when the GitHub Actions deploy hook is
   used, so one merge produces one deployment.
6. Save the Render deploy hook as the `RENDER_DEPLOY_HOOK_URL` GitHub
   environment secret.
7. Save the backend health URL and a database-backed endpoint URL as the
   corresponding GitHub environment variables.

## Required pull-request check

After the workflow has completed successfully at least once, open
**Settings > Branches > Branch protection rule** for `main`. Require a pull
request and require the status check named
`Install, lint, build, and test` before merging.

After `.github/workflows/security.yml` has passed on `main`, add these status
checks to the same rule so security failures block merging:

- `Dependency audit (frontend)`
- `Dependency audit (backend)`
- `Secret scan (full history)`

## Verification and metrics

For the first successful `main` deployment:

1. Open the Vercel URL and confirm the TSEK interface loads.
2. Open the Render health endpoint and confirm it returns a successful status.
3. Open the database check endpoint and confirm it returns records from Neon
   PostgreSQL.
4. Record the GitHub Actions duration and deployment result in
   `docs/PIPELINE_METRICS.MD`.
5. Record failures and recovery actions in `docs/INCIDENTS.MD`.

Do not mark deployment or database verification as complete until the public
URLs return successful responses.

## Security checks

`.github/workflows/security.yml` runs on every pull request into `main`, every
push to `main`, and every Monday:

| Job | Fails when | Why |
|---|---|---|
| Dependency audit (frontend, backend) | A production dependency has a high or critical advisory, or any dependency has a critical one | Shipped code must not carry known serious vulnerabilities. Dev-only tools such as linters fail only on critical. |
| Secret scan (full history) | Gitleaks finds a secret in any commit of the repository | Scans every commit, not just the latest files, for known key, password and token patterns. A clean scan means no *detectable* secret was found; it cannot prove that none exists. |

`.gitleaks.toml` allowlists only known synthetic fixture *values* (fake
database URLs and fake key blocks used by tests), never whole files, so a real
credential committed to a test file is still caught. If the scan finds a real secret:

1. **Rotate it first** in the provider's dashboard (OpenAI, Neon, Render,
   Vercel). Then update it **everywhere it is used**: the Render service's
   environment for runtime secrets (`DATABASE_URL`, `OPENAI_API_KEY`,
   `JWT_SECRET`), or the GitHub environment for deploy hooks, and redeploy or
   restart the service so it loads the new value. Rotating `JWT_SECRET` signs
   everyone out, which is expected.
2. Tell the team and record an incident in `docs/INCIDENTS.MD`.
3. Removing the commit does not make a pushed secret safe. Rotation does.
