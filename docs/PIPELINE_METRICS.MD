# TSEK CI/CD Pipeline Metrics

## Purpose

This document records the performance and reliability of the
TSEK continuous integration and deployment pipeline.

## Sprint metrics log

Course template (CSP221A DevOps track). Update before every consultation.
Sprint weeks run Monday to Sunday, Philippine time: Sprint 1 is 12–18 Oct,
Sprint 2 is 19–25 Oct, Sprint 3 is 26 Oct–1 Nov, Sprint 4 is 2–8 Nov 2026.
Sprint 3 figures cover runs up to 28 Oct 2026 22:57 PHT.

| week | avg PR pipeline (min) | main pipeline (min) | success rate (%) | prod deploys | lead time, merge→live (min) | failed deploys | time to recover (min) | change made |
|---|---|---|---|---|---|---|---|---|
| sprint 1 | — (no PR runs) | — | 0 (0/1) | 0 | — | 0 | — | First workflow file drafted; it failed to start (see INC-01). |
| sprint 2 | 0.2 (median 12 s, n=6) | 0.4 (23 s, n=1) | 100 (7/7) | 0 | — | 0 | — | CI on every pull request (PR #2); branch protection on `main`. |
| sprint 3 | 0.2 (median 11 s, p90 16 s, n=50) | 0.7 (median 44 s, n=8) | 100 CI (50/50); 95 all PR workflows (138/145) | 0 | — | 0 | — | Issue-link check (#43), staging→production deploy jobs (#44), AI review and bundle audit (#47). |
| sprint 4 | | | | | | | | |

Read with these caveats:

- **Production deploys are 0.** All 8 Sprint 3 `main` runs show green
  staging and production jobs, but every deploy-hook and smoke-test step
  was skipped because the hooks and URLs are not configured (INC-02).
  Lead time, failed deploys and time to recover cannot be measured until a
  real deployment runs.
- **Success rate** is passed ÷ (passed + failed). Cancelled runs (replaced
  by a newer push) and skipped runs (AI review on draft PRs) did not reach
  a result and are left out. Sprint 3 CI: 50 passed, 0 failed, 3 cancelled.
  All Sprint 3 PR workflows: 138 passed, 7 failed, 4 cancelled, 11 skipped.
  The 7 failures were all `PR links an issue` doing its job: the PR had no
  `Closes #N`.

## Current snapshot

Measured 29 Oct 2026 from the GitHub Actions API: all 187 workflow runs
from 13 Oct 2026 14:56 to 28 Oct 2026 22:57 PHT.

| Metric | Value |
|---|---|
| Pull request checks (`CI and deployment`) | 59 runs: 56 passed, 3 cancelled by a newer push, 0 failed |
| Pull request check duration (Sprint 3) | Median 11 s, mean 12.9 s, 90th percentile 16 s, max 49 s (50 runs). Dependency installation is 3.6 s of that on average (28 %); lint, build and test together are 2.6 s. |
| `main` pipeline runs | 9 runs, 9 passed. Sprint 3 median 44 s, first job start to last job end. |
| Issue-link check (`PR links an issue`) | 47 runs: 40 passed, 7 failed because the PR had no `Closes #N`; each failure blocked merging until fixed |
| AI review | 39 runs: 27 passed (median 15 s), 11 skipped (draft PRs), 1 cancelled by a newer push |
| Frontend bundle audit | 23 runs, 23 passed, median 13 s |
| Production deployments | 0 through the pipeline (INC-02). The public frontend is deployed outside the pipeline and serves a commit that is not on `main` (INC-03). |

### Measurement method

Pull request durations are the start-to-completion time of the
`Install, lint, build, and test` job, not the workflow run's wall-clock
time. The run's `updated_at` is bumped when GitHub later evaluates skipped
jobs, which inflated three PR #3 runs on 19 Oct to 19–31 minutes. Their
check job actually took 9–10 s
([39282439229](https://github.com/Anthonyiwnl/tsek/actions/runs/39282439229),
[39284248028](https://github.com/Anthonyiwnl/tsek/actions/runs/39284248028));
the job record of
[39279458172](https://github.com/Anthonyiwnl/tsek/actions/runs/39279458172)
ends 4 minutes after its last step. It is kept as recorded (261 s) and
included in the Sprint 2 figures; the log reports medians so that a single
record like this does not distort the trend.
`main` durations run from the first job's start to the last job's end.

## Metrics Log

| Date (PHT) | Run | Trigger | CI Duration | CI Result | Deployment Result | Notes |
|---|---|---|---|---|---|---|
| 13 Oct 2026 14:56 | [38359619851](https://github.com/Anthonyiwnl/tsek/actions/runs/38359619851) | Push to `ci/github-actions` | 0 s | Failure | Not run | Workflow file failed to start; no jobs ran. Fixed before PR #2 was opened. |
| 19 Oct 2026 22:55 | [39273266612](https://github.com/Anthonyiwnl/tsek/actions/runs/39273266612) | PR #2 | 25 s | Success | Not run (pull request) | First pull request check; PR #2 introduced the CI workflow. |
| 19 Oct 2026 22:56 | [39273443100](https://github.com/Anthonyiwnl/tsek/actions/runs/39273443100) | Merge of PR #2 | 27 s | Success | Hook calls skipped, hooks not configured | First run on `main`. |
| 27 Oct 2026 01:10 | [40366163502](https://github.com/Anthonyiwnl/tsek/actions/runs/40366163502) | Merge of PR #43 | 26 s | Success | Hook calls skipped, hooks not configured | Added the issue-link check. |
| 27 Oct 2026 01:23 | [40368107102](https://github.com/Anthonyiwnl/tsek/actions/runs/40368107102) | Merge of PR #44 | 49 s | Success | Hook calls skipped, hooks not configured | Added staging and production deploy jobs. |
| 27 Oct 2026 01:24 | [40368344458](https://github.com/Anthonyiwnl/tsek/actions/runs/40368344458) | Merge of PR #47 | 48 s | Success | Hook calls skipped, hooks not configured | Added AI review and bundle audit. |
| 27 Oct 2026 07:49 | [40422408368](https://github.com/Anthonyiwnl/tsek/actions/runs/40422408368) | PR #4, issue-link check | 8 s | Failure | Not run (pull request) | No `Closes #N`; the required check blocked merging. |
| 27 Oct 2026 07:49 | [40422408428](https://github.com/Anthonyiwnl/tsek/actions/runs/40422408428) | PR #4, CI | 18 s | Success | Not run (pull request) | Frontend and backend install, lint and build; backend tests. |
| 27 Oct 2026 07:59 | [40423434307](https://github.com/Anthonyiwnl/tsek/actions/runs/40423434307) | PR #4, issue-link check | 6 s | Success | Not run (pull request) | Passed after `Closes #7` was added; PR #4 then merged. |
| 27 Oct 2026 07:59 | [40423458842](https://github.com/Anthonyiwnl/tsek/actions/runs/40423458842) | Merge of PR #4 | 49 s | Success | Hook calls skipped, hooks not configured | Backend now on `main`. |
| 27 Oct 2026 11:15 | [40443179610](https://github.com/Anthonyiwnl/tsek/actions/runs/40443179610) | PR #49, CI | 17 s | Success | Not run (pull request) | |
| 27 Oct 2026 11:16 | [40443290759](https://github.com/Anthonyiwnl/tsek/actions/runs/40443290759) | Merge of PR #3 | 47 s | Success | Hook calls skipped, hooks not configured | |

## Pull request check verification (issue #12)

### 1. Every pull request to `main` runs install, lint and build

The `Install, lint, build, and test` job runs on every pull request into
`main`. Its steps run for each component that has a `package-lock.json`;
both `frontend/` and `backend/` have one on `main` since PR #4. Backend
lint, build and test use `npm run --if-present`, and the backend has no
`build` script yet, so "Build backend" currently passes without doing
anything. In PR #4's run
([job 121919782232](https://github.com/Anthonyiwnl/tsek/actions/runs/40422408428/job/121919782232),
13 s) these steps ran and passed:

1. Install frontend dependencies
2. Lint frontend
3. Build frontend
4. Install backend dependencies
5. Lint backend
6. Build backend
7. Test backend

### 2. A failing check blocks the pull request, and a corrected run passes

PR #4 was opened without `Closes #N`. The required `PR links an issue`
check failed
([run 40422408368](https://github.com/Anthonyiwnl/tsek/actions/runs/40422408368))
and GitHub disabled the merge button even though the PR already had an
approving review. After `Closes #7` was added to the description, the
check passed
([run 40423434307](https://github.com/Anthonyiwnl/tsek/actions/runs/40423434307))
and PR #4 was merged.

This was a real failure, not a staged one. PR #42 shows the same
behaviour five times (for example
[run 40367303039](https://github.com/Anthonyiwnl/tsek/actions/runs/40367303039)).

### 3. `main` requires checks and a teammate review

The branch protection rule on `main` requires:

- the status checks `Install, lint, build, and test` and `PR links an issue`
- at least one approving review from a teammate with write access
- all review conversations resolved before merging

Screenshots of the rule and of a blocked merge are attached to the pull
request that closes #12.

### 4. Pipeline origin

The CI workflow was introduced by
[PR #2 (Ci/GitHub actions)](https://github.com/Anthonyiwnl/tsek/pull/2).
Its pull request check passed in
[run 39273266612](https://github.com/Anthonyiwnl/tsek/actions/runs/39273266612),
and the first `main` run passed in
[run 39273443100](https://github.com/Anthonyiwnl/tsek/actions/runs/39273443100).

## Metrics to Track

- Total CI execution time
- Dependency installation time
- Frontend build time
- Backend test duration
- Successful and failed CI runs
- Deployment success and duration
- Post-deployment health-check results

## Measurement Method

Record actual results from GitHub Actions and the hosting
provider dashboards. Update the snapshot before each consultation.

Do not record estimated results as measured results.
