# TSEK CI/CD Incidents

## Purpose

Record significant CI failures, deployment problems, and
recovery actions. Each incident gets a short postmortem using the
template at the end of this file.

## Incident Log

| ID | Opened (PHT) | Title | Status | Time to recover |
|---|---|---|---|---|
| INC-01 | 13 Oct 2026 14:56 | First CI workflow failed to start | Resolved 19 Oct 2026 | Not user-facing; first green run 6 days later |
| INC-02 | 27 Oct 2026 01:23 | `main` pipeline reports successful deploys that deploy nothing | Open (#13) | — |
| INC-03 | 29 Oct 2026 | Public frontend serves a commit that is not on `main` | Open | — |
| INC-04 | 27 Oct 2026 01:23 | AI review has never completed a review (OpenAI HTTP 429) | Open | — |

---

### INC-01 · First CI workflow failed to start

**Incident.** The first push of `.github/workflows/ci.yml` to the
`ci/github-actions` branch produced a run that failed before any job
started ([run 38359619851](https://github.com/Anthonyiwnl/tsek/actions/runs/38359619851),
0 jobs).

**Impact.** No checks ran on that branch. No pull request, deployment or
user was affected.

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

**Resolution.** Open. Steps:

1. Create the staging and production Vercel and Render services and add
   their deploy hooks and URLs to the matching GitHub environments (#13).
2. Merge #58 so `/health` reports the deployed commit; without it the
   backend smoke test times out once a URL is configured.
3. On `main`, make a missing hook fail the deploy job instead of passing.

**Prevention.** Step 3 above. A deploy job that cannot deploy must be red.

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

**Root cause.** Likely: TSEK has more than one Vercel project.
`tsek-app.vercel.app` belongs to the team's original project (linked from
PR #62 under `heroopogis-projects`), which deploys branches through its own
Git integration. The pipeline-managed `tsek` and `tsek-staging` projects
live under the DevOps Engineer's Vercel account. To be confirmed in Vercel.

**Resolution.** Open. Choose one production URL and point it at the
pipeline-managed `tsek` project with `main` as its production branch.
Retire the original project or stop it from deploying production from
other branches. Preview deployments for pull requests can stay.

**Prevention.** The production smoke test compares the served `tsek-commit`
with the commit being deployed, so it fails if production drifts from
`main` once `FRONTEND_URL` is configured.

---

### INC-04 · AI review has never completed a review

**Incident.** Since `ai-review.yml` merged in PR #47, every TSEK AI review
comment reports that OpenAI returned HTTP 429, for example on PRs #47, #58,
#62, #63 and #66. The workflow itself passes.

**Impact.** No AI review has reached a pull request; only the automatic
secret and frontend-access checks ran. The fallback worked as designed and
no merge was blocked.

**Root cause.** Likely: the key in `AI_REVIEW_OPENAI_API_KEY` has no usable
quota (no billing or credits), which OpenAI reports as HTTP 429. To be
confirmed in the OpenAI usage dashboard.

**Resolution.** Open. Add credits to the AI-review project's key, with a
monthly spend cap, then re-run the review on an open PR.

**Prevention.** Count a 429 or provider failure as a failed review in the
metrics log, and add a scheduled live smoke test of the provider.

---

## Incident Record Template

### INC-NN · Title

**Incident.** What happened, with run or deployment links.

**Impact.** Which component, workflow or users were affected.

**Root cause.** The identified cause. Mark it "likely" until confirmed.

**Resolution.** How it was fixed, or the open steps.

**Prevention.** How a repeat will be caught or prevented.
