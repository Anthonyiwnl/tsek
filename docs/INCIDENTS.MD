# TSEK CI/CD Incidents

## Purpose

Record significant CI failures, deployment problems, and
recovery actions. Each incident gets a short postmortem using the
template at the end of this file.

## Incident Log

| ID | Opened (PHT) | Title | Status | Time to recover |
|---|---|---|---|---|
| INC-01 | 13 Oct 2026 14:56 | First CI workflow failed to start | Resolved 19 Oct 2026 | 6 days |
| INC-02 | 27 Oct 2026 01:23 | `main` pipeline reports successful deploys that deploy nothing | Resolved 1 Nov 2026 22:59 | 5 days 22 h |
| INC-03 | 29 Oct 2026 | Public frontend serves a commit that is not on `main` | Mitigated 1 Nov 2026 | — |
| INC-04 | 27 Oct 2026 01:23 | AI review has never completed a review (OpenAI HTTP 429) | Open | — |
| INC-05 | 1 Nov 2026 19:46 | Deploy jobs received empty hook secrets after #94 | Resolved 1 Nov 2026 21:05 | 79 min |
| INC-06 | 1 Nov 2026 21:06 | Staging hook deployed production; Render services on the wrong branch | Resolved 1 Nov 2026 22:15 | 69 min |
| INC-07 | 1 Nov 2026 23:05 | Vercel free-plan deployment limit reached | Resolved 1 Nov 2026 23:31 | 26 min |
---

### INC-01 · First CI workflow failed to start

**Incident.** The first push of `.github/workflows/ci.yml` to the
`ci/github-actions` branch produced a run that failed before any job
started ([run 38359619851](https://github.com/Anthonyiwnl/tsek/actions/runs/38359619851),
0 jobs).

**Impact.** No checks ran on that branch. No pull request, deployment or
user was affected, so the 6-day recovery had no user impact.

**Root cause.** GitHub rejected the workflow file at startup (a workflow
definition error rather than a failing step).

**Resolution.** The workflow was corrected before PR #2 was opened. PR #2's
check passed on 19 Oct
([run 39273266612](https://github.com/Anthonyiwnl/tsek/actions/runs/39273266612)).

**Prevention.** Workflow changes arrive through pull requests, so a broken
workflow fails on its own PR instead of on `main`.

---

### INC-02 · `main` pipeline reports successful deploys that deploy nothing

**Incident.** Since the staging and production jobs merged in PR #44, all 8
`main` runs show green `Staging / Deploy`, `Staging / Smoke test`,
`Production / Deploy` and `Production / Smoke test` jobs, for example
[run 40453800570](https://github.com/Anthonyiwnl/tsek/actions/runs/40453800570).
In every run the Vercel and Render trigger steps and all three smoke-test
checks were skipped.

**Impact.** No merge to `main` has reached a live environment through the
pipeline. Anyone reading the Actions tab would count 8 successful
production deploys; the true number is 0. Issue #13 requires that
missing deployment configuration is not reported as a successful deployment.

**Root cause.** The `VERCEL_DEPLOY_HOOK_URL` and `RENDER_DEPLOY_HOOK_URL`
environment secrets and the `FRONTEND_URL`, `BACKEND_HEALTHCHECK_URL` and
`DATABASE_CHECK_URL` variables are not set in the `staging` and
`production` GitHub environments. `deploy.yml` deliberately skips a missing
hook and only writes a note to the job summary, so the job still passes.

**Resolution.** Resolved 1 Nov 2026.

1. The deploy hooks and smoke-test URLs were added to both GitHub
   environments (production on 27 Oct, staging on 1 Nov).
2. #58 made `/health` report the deployed commit.
3. #67 makes a missing hook or URL **fail** the job before anything runs,
   and names the missing setting.

The first merge deployed and verified end to end by the pipeline alone was
[run 41316410179](https://github.com/Anthonyiwnl/tsek/actions/runs/41316410179)
(#81, 1 Nov 22:29). #67 merged at 22:59, and its own run passed with the
new checks in place
([run 41318916883](https://github.com/Anthonyiwnl/tsek/actions/runs/41318916883)).

**Prevention.** Step 3 above (#67). A deploy job that cannot deploy is now red.

---

### INC-03 · Public frontend serves a commit that is not on `main`

**Incident.** On 29 Oct 2026 the public frontend
`https://tsek-app.vercel.app` reported `tsek-commit`
`34eba2b2a87897407a7603d9c404c506773fa0f6`. That commit is the head of
`codex/60-figma-ui-logo` (draft PR #61), which is not merged. `main` is at
`1c35fee`.

**Impact.** The course requires production to always reflect `main`. The
public site currently shows unreviewed work, and a demo from it would not
match the repository.

**Root cause.** Confirmed 1 Nov: TSEK had two sets of Vercel projects.
`tsek-app.vercel.app` and `tsek-staging-xi.vercel.app` belong to Hero's
original account and deploy branches through their own Git integration. The
pipeline deploys to the DevOps Engineer's `tsek` (production,
`tsek-seven.vercel.app`) and `tsek-staging` projects.

**Resolution.** Mitigated 1 Nov. The team uses `tsek-seven.vercel.app` as the
production URL, because only projects in the DevOps account can be rolled
back from the dashboard during a demo (Vercel's free plan cannot share
projects). Since 1 Nov it serves `main` and is verified by the production
smoke test on every merge. Open: Hero's projects still exist and serve old
commits. They should be retired, or at least never shared as the production
link.

**Prevention.** The production smoke test compares the served `tsek-commit`
with the commit being deployed, so it fails if production drifts from
`main` once `FRONTEND_URL` is configured.

---

### INC-04 · AI review has never completed a review

**Incident.** Since `ai-review.yml` merged in PR #47, every TSEK AI review
comment reports that OpenAI returned HTTP 429. The workflow itself passes.
Evidence:
[PR #47](https://github.com/Anthonyiwnl/tsek/pull/47#issuecomment-6419578078) (27 Oct 01:23),
[PR #58](https://github.com/Anthonyiwnl/tsek/pull/58#issuecomment-6435810830),
[PR #62](https://github.com/Anthonyiwnl/tsek/pull/62#issuecomment-6438683239),
[PR #63](https://github.com/Anthonyiwnl/tsek/pull/63#issuecomment-6472325705),
[PR #66](https://github.com/Anthonyiwnl/tsek/pull/66#issuecomment-6488296743) (29 Oct).

**Impact.** No AI review has reached a pull request; only the automatic
secret and frontend-access checks ran. The fallback worked as designed and
no merge was blocked.

**Root cause.** Likely: the key in `AI_REVIEW_OPENAI_API_KEY` has no usable
quota (no billing or credits), which OpenAI reports as HTTP 429. To be
confirmed in the OpenAI usage dashboard.

**Resolution.** Open. Still happening on 1 Nov (for example the review on
[PR #68](https://github.com/Anthonyiwnl/tsek/pull/68)). Add credits to the
AI-review project's key, with a monthly spend cap, then re-run the review on
an open PR. CodeRabbit reviewed every pull request in the meantime, so the
mentor's "automated reviewer" requirement is still met.

**Prevention.** Count a 429 or provider failure as a failed review in the
metrics log, and add a scheduled live smoke test of the provider.

---

### INC-05 · Deploy jobs received empty hook secrets after #94

**Incident.** #94 moved the deploy jobs into `deploy-main.yml` and, following
a review suggestion, stopped passing secrets to the reusable `deploy.yml`.
The next three `main` runs
([41303385163](https://github.com/Anthonyiwnl/tsek/actions/runs/41303385163),
[41307818998](https://github.com/Anthonyiwnl/tsek/actions/runs/41307818998),
[41308583202](https://github.com/Anthonyiwnl/tsek/actions/runs/41308583202))
started the staging deploy with both hook secrets empty. The deploy job
skipped both hooks and stayed green (INC-02 behaviour, #67 not yet merged).
The staging smoke test then timed out after 10 minutes.

**Impact.** Three merges were not deployed. Production was not touched,
because the failed staging smoke test blocked it.

**Root cause.** GitHub's documentation: a reusable workflow only receives
secrets the caller passes, even environment secrets; otherwise "the secret
resolves to an empty string … The workflow run doesn't show an error." The
review suggestion said the opposite and was applied without checking the
documentation.

**Resolution.** #96 passes exactly the two hook secrets by name (not every
secret), and `deploy.yml` declares them. Merged 21:05; the next run's hooks
fired.

**Prevention.** #67 now fails a deploy whose hooks are empty, so this shows
as red within seconds instead of after a 10-minute smoke test. Review
suggestions that change secret or deploy wiring are checked against GitHub's
documentation before merging.

---

### INC-06 · Staging hook deployed production; Render services on the wrong branch

**Incident.** The first deploy with secrets
([run 41309599966](https://github.com/Anthonyiwnl/tsek/actions/runs/41309599966),
attempts 1–3) found three configuration errors in turn:

1. The `staging` environment's `VERCEL_DEPLOY_HOOK_URL` held the
   **production** project's hook. The staging step at 21:06 deployed `main`
   to the production frontend (`tsek-seven.vercel.app`), and `tsek-staging`
   was never built.
2. Render `tsek-api-staging` was connected to branch
   `backend/applications-crud` (PR #5's branch), so its hook rebuilt that
   branch, not `main`.
3. Render `tsek-fl10` (production) was also not on `main`.

**Impact.** The production frontend received `main` (0304513) without
passing the staging smoke test. It was a working build and was confirmed
by the later green run. Staging and production backends kept serving old
code. The staging gate stopped the backend problems from reaching
production.

**Root cause.** Hosting settings entered by hand were never verified
against the pipeline: hooks copied from the wrong project, and services
created from feature branches.

**Resolution.** The staging and production Vercel hook secrets were re-set
from each project's own deploy hook. The Render staging and production
services were switched to `main`. A full re-run (attempt 4, 22:14) passed
staging and production. Lesson: "Re-run failed jobs" only re-ran the smoke
test, not the deploy, so a full re-run was needed.

**Prevention.** The smoke tests compare the served commit on every layer, so
a wrong hook or branch fails the run. The runbook (#88) lists the expected
branch and hook for each environment.

---

### INC-07 · Vercel free-plan deployment limit reached

**Incident.** On 1 Nov about 23:05, Vercel stopped creating deployments
("Deployment rate limited — retry in 24 hours"), shown as a red
`Vercel – tsek-staging` status on PR #68.

**Impact.** Pull request previews stopped. Any merge would have failed its
staging deploy until the limit reset, so #68 was held.

**Root cause.** The Hobby plan allows 100 deployments per day per account.
Both `tsek` and `tsek-staging` built a preview for every push to every PR
branch, and about 30 PR updates that day used up the allowance.

**Resolution.** The Vercel account was upgraded to Pro (6,000 deployments
per day) at 23:28. The rate-limited preview for #68 was rebuilt from the
Vercel dashboard (23:31), and #68 merged and deployed green.

**Prevention.** Measured as an optimization candidate: building
`tsek-staging` only for production deploys, and `tsek` previews only when
`frontend/` changes, would cut builds per busy day from about 100 to about
15–20. This was tried and then reverted after the upgrade; see the
optimization log.

---

## Incident Record Template

### INC-NN · Title

**Incident.** What happened, with run or deployment links.

**Impact.** Which component, workflow or users were affected.

**Root cause.** The identified cause. Mark it "likely" until confirmed.

**Resolution.** How it was fixed, or the open steps.

**Prevention.** How a repeat will be caught or prevented.
