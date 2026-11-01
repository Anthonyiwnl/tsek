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

> Until #58 is on `main`, `/health` returns only `{"status":"ok"}` with no
> `commit`, so step 1 (and the pipeline's backend smoke check) cannot pass yet.
> Steps 2–4 work now.

1. **Backend:** open `<backend URL>/health`. `commit` must equal the merged
   commit on `main`: the merge commit shown on the merged pull request, or
   `git fetch origin main --quiet && git rev-parse origin/main`.
2. **Frontend:** view the page source of the frontend URL. The
   `<meta name="tsek-commit">` value must be the same commit.
3. **Database:** open `<backend URL>/api/document-types`. It must return the
   catalogue from Neon.
4. In GitHub, **Environments** on the repository home page shows the latest
   deployment for staging and production.

If a deploy job fails, the job summary says why. Once #67 is on `main`, a
missing deploy hook secret or verification URL **fails** the job and the
summary names it. Before #67, a missing value is only *skipped*: the job stays
green and its summary says the hook or check was skipped, so read the summary,
not just the colour. Set the missing value in the matching GitHub environment,
then re-run the workflow for the same commit.

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
4. After a rollback, Vercel stops making new deployments live in production
   until you promote one. That is handled in 2b, step 5: promote the
   deployment of the revert, not the broken one.

**Backend (Render):**

1. Render → service `tsek-api` → **Deploys**.
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
   - `commit`: the bad commit on `main`'s own history: the merge commit of the
     pull request that broke production (the workflow rejects commits from
     inside a merged branch);
   - `issue`: the incident issue number.
3. The workflow opens a pull request named `revert: …` that closes the
   incident issue. Checks on pull requests opened by GitHub Actions may not
   start, or may wait for approval: if GitHub shows **Approve workflows to
   run**, a teammate with write access clicks it; if no checks appear, close
   and reopen the pull request. Confirm the required checks pass.
4. A teammate reviews and merges the revert pull request. The pipeline deploys
   the reverted code to staging, then production, and the smoke tests confirm
   the new commit is live.
5. **If you used 2a on Vercel:** the pipeline's new production deployment is
   built but not made live, because of the rollback. As soon as it shows
   **Ready** in Vercel → `tsek` → Deployments (it is the one for the revert's
   merge commit), click **⋯ → Promote to Production**. Do this while the
   production smoke test is waiting (it waits about 6 minutes). Do **not**
   undo the rollback before the merge, because that would put the broken
   version back live.

If the workflow says it cannot open pull requests, it prints a link to open the
pull request yourself. That is the default and recommended path. GitHub's
**Allow GitHub Actions to create and approve pull requests** setting would let
the workflow open it, but the same setting also lets workflows *approve* pull
requests, so leave it off. Branch protection would still require a teammate's
approval, but there is no create-only option.

Manual alternative: `git revert -m 1 <merge commit>` on a new branch, then open
a pull request as usual.

### 2c. Database

Migrations only move forward, so a code rollback does not undo a migration.

- **Bad data:** don't restore over production directly. In Neon, create a
  branch from production **at a time before the problem** (point-in-time
  branch, within the plan's history retention window) and check the data
  there. Reconcile anything written after that time, agree with a teammate,
  then restore production from it with writes paused (maintenance or backend
  stopped). Keep the pre-restore branch until everything is verified. Practise
  on `staging` first.
- **Bad migration:** write a new forward migration that undoes it and ship it
  through a pull request.

---

## 3. After every rollback

Record it in [`INCIDENTS.MD`](INCIDENTS.MD) using the incident template:

- detection time, rollback finished time, and **time to recover** (minutes);
- the bad commit, the rollback method (2a, 2b or both), and run links;
- root cause and the change that prevents it.

Add it to the **Sprint metrics log** table in
[`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD): count the failed deploy and add
the recovery minutes to the current sprint's row (added by #66).

---

## 4. Leaked secret

1. **Rotate it first** in the provider dashboard (OpenAI, Neon, Render,
   Vercel). Then update it where it is used: the Render service environment
   for runtime secrets (`DATABASE_URL`, `OPENAI_API_KEY`, `JWT_SECRET`), or the
   GitHub environment for deploy hooks, and redeploy or restart the service so
   it loads the new value. Rotating `JWT_SECRET` signs everyone out.
2. Tell the team and file an **Incident** issue. Never paste the secret.
3. Removing the commit does not make a pushed secret safe. Rotation does.

---

## 5. Demo Day checklist

- [ ] 10 minutes before: open the production `/health` URL to wake Render.
- [ ] Confirm `/health` `commit` matches `main`.
- [ ] Have the last good production deployment open in Vercel and Render, ready for 2a.
- [ ] Have **Actions → Rollback** open, ready for 2b.
