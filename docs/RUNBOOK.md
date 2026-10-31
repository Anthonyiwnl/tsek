# Deploy and rollback runbook

Any teammate should be able to follow this without the DevOps engineer.

| | Staging | Production |
|---|---|---|
| Frontend | Vercel project `tsek-staging` | Vercel project `tsek` |
| Backend | Render service `tsek-api-staging` | Render service `tsek-api` |
| Database | Neon branch `staging` | Neon branch `main` |
| GitHub environment | `staging` | `production` |

Setup of these projects and their secrets is in [`STAGING.md`](STAGING.md).

---

## 1. Normal deploy

There are no manual deploy steps. Merging to `main` is the deploy.

1. Open a pull request that closes one issue. Wait for the required checks.
2. A teammate reviews and approves it. Merge it.
3. The **CI and deployment** workflow on `main` then runs:
   `checks → Staging / Deploy → Staging / Smoke test → Production / Deploy → Production / Smoke test`.
4. Production is deployed only if the staging smoke test passed.

### Check that a deploy worked

The smoke tests do this automatically. To check by hand (for example before a
consultation, which also wakes up Render's free service):

1. **Backend:** open `<backend URL>/health`. `commit` must equal the merged
   commit on `main` (`git rev-parse origin/main`).
2. **Frontend:** view the page source of the frontend URL. The
   `<meta name="tsek-commit">` value must be the same commit.
3. **Database:** open `<backend URL>/api/document-types`. It must return the
   catalogue from Neon.
4. In GitHub, **Environments** on the repository home page shows the latest
   deployment for staging and production.

If a deploy job fails, the job summary says why (for example, a missing
deploy hook secret). Fix the cause and re-run the failed jobs from the run page.

---

## 2. Roll back production

Do this when production is broken after a merge. **Restore service first, then
fix forward.**

### 2a. Emergency rollback in the host dashboards (about 1–2 minutes)

Use this during an outage or on Demo Day.

**Frontend (Vercel):**

1. Vercel → project `tsek` → **Deployments**.
2. Find the last production deployment that worked (its commit is in the row).
3. **⋯ → Instant Rollback** (Hobby plan: to the previous production
   deployment) or **Promote to Production** on an older one.
4. After a rollback, Vercel stops assigning new deployments to production until
   you undo the rollback or promote a newer deployment. Do that after the Git
   rollback (2b) is deployed.

**Backend (Render):**

1. Render → service `tsek-api` → **Events** (deploy history).
2. On the last good deploy, click **Rollback**.
3. Render may disable automatic deploys after a rollback. The pipeline uses
   deploy hooks with auto-deploy off, so nothing else needs to change.

**Confirm:** `<backend URL>/health` and the frontend `tsek-commit` tag show the
last good commit.

### 2b. Git rollback (makes `main` match production again)

A dashboard rollback is temporary: the next merge would deploy the broken code
again. Revert it on `main`:

1. Create an issue with the **Incident** template (for example #91).
2. GitHub → **Actions → Rollback → Run workflow**. Enter:
   - `commit`: the bad commit on `main` (usually the merge commit of the pull
     request that broke production);
   - `issue`: the incident issue number.
3. The workflow opens a pull request named `revert: …` that closes the
   incident issue. **Close it and reopen it** so the checks start. Pull
   requests opened by GitHub Actions do not trigger other workflows.
4. A teammate reviews and merges it. The pipeline deploys the reverted code to
   staging, then production, and the smoke tests confirm the new commit is live.
5. If you used 2a, undo the Vercel rollback or promote the new deployment so
   production follows `main` again.

If the workflow says it cannot open pull requests, it prints a link to open the
pull request yourself. To let it open them, enable **Settings → Actions →
General → Allow GitHub Actions to create and approve pull requests**.

Manual alternative: `git revert -m 1 <merge commit>` on a new branch, then open
a pull request as usual.

### 2c. Database

Migrations only move forward, so a code rollback does not undo a migration.

- **Bad data:** restore the Neon branch to a time before the problem
  (Neon → branch → **Restore**) within the plan's history retention window.
  Restore `staging` first to practice.
- **Bad migration:** write a new forward migration that undoes it and ship it
  through a pull request.

---

## 3. After every rollback

Record it in [`INCIDENTS.MD`](INCIDENTS.MD) using the incident template:

- detection time, rollback finished time, and **time to recover** (minutes);
- the bad commit, the rollback method (2a, 2b or both), and run links;
- root cause and the change that prevents it.

Add the recovery time to the sprint row in
[`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD) (failed deploys, time to recover).

---

## 4. Leaked secret

1. **Rotate it first** in the provider dashboard (OpenAI, Neon, Render,
   Vercel), then update the matching GitHub environment secret.
2. Tell the team and file an **Incident** issue. Never paste the secret.
3. Removing the commit does not make a pushed secret safe. Rotation does.

---

## 5. Demo Day checklist

- [ ] 10 minutes before: open the production `/health` URL to wake Render.
- [ ] Confirm `/health` `commit` matches `main`.
- [ ] Have the last good production deployment open in Vercel and Render, ready for 2a.
- [ ] Have **Actions → Rollback** open, ready for 2b.
