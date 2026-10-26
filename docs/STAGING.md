# Staging and Production Environments

## Release flow

```
Pull request:   install → lint → build → test → issue-link check
Merge to main:  checks → deploy STAGING → smoke test staging
                       → deploy PRODUCTION → smoke test production
```

Production is deployed only after the staging smoke test passes. A failed
staging release never reaches production.

## Environments

| | Staging | Production |
|---|---|---|
| GitHub environment | `staging` | `production` |
| Database | Neon branch `staging` | Neon branch `main` |
| Backend | Render service `tsek-api-staging` | Render service `tsek-api` |
| Frontend | Vercel project `tsek-staging` | Vercel project `tsek` |
| OpenAI key | Separate key with a low spending limit | Production key |

Both GitHub environments use the same secret and variable names, so one
reusable workflow (`.github/workflows/deploy.yml`) deploys either one.

| Name | Type | Value |
|---|---|---|
| `VERCEL_DEPLOY_HOOK_URL` | Secret | Deploy hook of that environment's Vercel project |
| `RENDER_DEPLOY_HOOK_URL` | Secret | Deploy hook of that environment's Render service |
| `FRONTEND_URL` | Variable | Public URL of that environment's frontend |
| `BACKEND_HEALTHCHECK_URL` | Variable | `https://<backend>/health` |
| `DATABASE_CHECK_URL` | Variable | `https://<backend>/api/document-types` |

## Setup

### 1. Neon database

1. In the Neon project, open **Branches → Create branch**, name it `staging`,
   and branch it from `main`.
2. Copy the `staging` branch connection strings (pooled for the app, direct
   for migrations).
3. Run the migrations and seed against the staging branch.

### 2. OpenAI

Create a separate API key for staging in its own OpenAI project and set a
low monthly budget on that project.

### 3. Render backend

1. Create a second web service, `tsek-api-staging`, from the same repository
   and branch (`main`), root directory `backend`.
2. Set its environment variables to the staging values: staging
   `DATABASE_URL`, the staging `OPENAI_API_KEY`, its own `JWT_SECRET`, and
   `FRONTEND_URL` set to the staging frontend URL.
3. Turn **Auto-Deploy off** on both Render services. GitHub Actions triggers
   every deployment through the deploy hooks.
4. Copy each service's deploy hook into the matching GitHub environment.

### 4. Vercel frontend

1. Create a second Vercel project, `tsek-staging`, from the same repository
   with root directory `frontend`.
2. In each Vercel project, set the backend API URL variable to the matching
   backend (staging frontend → staging backend).
3. `frontend/vercel.json` disables automatic Vercel deployments from `main`,
   so production is only deployed by the pipeline after staging passes.
   Pull request preview deployments still run.
4. Create a deploy hook for `main` in each project and copy it into the
   matching GitHub environment. After the first run, confirm in the Vercel
   dashboard that the hook deployment ran.

### 5. GitHub environments

1. **Settings → Environments → staging** and **production**: add the secrets
   and variables listed above.
2. Both environments are set to **Deployment branches and tags → Protected
   branches only**, so only `main` can deploy.

## Smoke test

For each environment, the pipeline:

1. Checks that the commit is still the newest on `main`. Deploy hooks build
   the newest commit, so if `main` has moved on, this run skips deploying and
   the run for the newer commit deploys and tests it.
2. Polls `BACKEND_HEALTHCHECK_URL` for up to 10 minutes (Render free
   services sleep and rebuild slowly) until the response contains this run's
   commit. The backend must return a `commit` field from
   `process.env.RENDER_GIT_COMMIT` in `/health`; without it the smoke test
   fails, because an older release could otherwise pass.
3. Polls `FRONTEND_URL` for up to 6 minutes until its `<meta name="tsek-commit">` tag contains
   this run's commit. Vercel fills the tag from `VITE_VERCEL_GIT_COMMIT_SHA`
   at build time; keep **Automatically expose System Environment Variables**
   turned on in both Vercel projects.
4. Checks that `DATABASE_CHECK_URL` responds successfully, retrying for up to
   about 5 minutes.

Each check has its own time limit, and the job limit (26 minutes) is longer
than all of them together, so a slow but healthy deployment is not cut off.

Missing any required deployment hook (`VERCEL_DEPLOY_HOOK_URL` or
`RENDER_DEPLOY_HOOK_URL`) or smoke-check URL (`FRONTEND_URL`,
`BACKEND_HEALTHCHECK_URL`, or `DATABASE_CHECK_URL`) blocks promotion to
production. Skipped deployment or verification steps do not count as a
successful staging release, even if the workflow reports success. Configure
all required secrets and variables, then rerun staging deployment and all
smoke checks successfully before promoting to production.
