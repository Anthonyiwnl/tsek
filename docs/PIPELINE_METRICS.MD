# TSEK CI/CD Pipeline Metrics

## Purpose

This document records the performance and reliability of the
TSEK continuous integration and deployment pipeline.

## Sprint metrics log

Course template (CSP221A DevOps track). Update before every consultation.
The "avg PR pipeline" column keeps the course's heading but reports the
**median**, so that single slow records do not distort it (see the
measurement method below).
Sprint weeks run Monday to Sunday, Philippine time: Sprint 1 is 12–18 Oct,
Sprint 2 is 19–25 Oct, Sprint 3 is 26 Oct–1 Nov, Sprint 4 is 2–8 Nov 2026.
Sprint 3 figures cover every run from 26 Oct to 1 Nov 2026 23:59 PHT,
measured from the GitHub Actions API on 1 Nov.

| week | avg PR pipeline (min) | main pipeline (min) | success rate (%) | prod deploys | lead time, merge→live (min) | failed deploys | time to recover (min) | change made |
|---|---|---|---|---|---|---|---|---|
| sprint 1 | — (no PR runs) | — | 0 (0/1) | 0 | — | 0 | — | First workflow file drafted; it failed to start (see INC-01). |
| sprint 2 | 0.2 (median 12 s, n=6) | 0.4 (23 s, n=1) | 100 (7/7) | 0 | — | 0 | — | CI on every pull request (PR #2); branch protection on `main`. |
| sprint 3 | 0.2 (median 13 s, p90 18 s, n=110) | 2.2 with real deploys (median 133 s, 114–146 s, n=4); 0.7 before deploys were configured (44 s, n=7) | PR checks 99 (110/111); `main` with real deploys 45 (5/11 attempts) | 5 | 2.3 (median 136 s, 117–150 s, n=4); the first one took 69 | 6 | 149 | Hosting connected to the pipeline; first real deploys (1 Nov); deploys fail when settings are missing (#67); backend and frontend tests required (#81, #83); deploy jobs split from PR checks (#94). |
| sprint 4 | | | | | | | | |

Read with these caveats:

- **The first 7 Sprint 3 `main` runs (27 Oct) are not deployments.** They
  show green deploy jobs, but every hook and smoke-test step was skipped
  because hosting was not configured (INC-02). They count toward the
  "before deploys" pipeline time only, not toward deploys or lead time.
- **Production deploys (5)** are runs where both production hooks fired and
  the production smoke test confirmed the new commit on the backend
  (`/health`), the frontend (`tsek-commit` tag) and the database endpoint:
  [41309599966 (attempt 4)](https://github.com/Anthonyiwnl/tsek/actions/runs/41309599966),
  [41316410179](https://github.com/Anthonyiwnl/tsek/actions/runs/41316410179),
  [41318214204](https://github.com/Anthonyiwnl/tsek/actions/runs/41318214204),
  [41318916883](https://github.com/Anthonyiwnl/tsek/actions/runs/41318916883),
  [41322017475](https://github.com/Anthonyiwnl/tsek/actions/runs/41322017475).
- **Lead time** is from the merge (run created) to the production smoke test
  passing. The median uses the 4 deploys that ran with no manual help. The
  first deploy (#96, 69 min) is shown separately because it waited on the
  INC-05 and INC-06 fixes and on Render services deployed by hand.
- **Failed deploys (6)** are run attempts on 1 Nov whose deploy or smoke
  test failed: 3 during INC-05 (hook secrets not passed) and 3 during INC-06
  (wrong Vercel hook, then Render staging and production on the wrong
  branch). In every one the staging gate or production smoke test stopped
  the release, and none left production on a broken version.
- **Time to recover (149 min)** runs from the first failed deploy (merge of
  #94, 19:46 PHT) to the first fully green run (22:15 PHT).
- **Success rate** is passed ÷ (passed + failed); cancelled and skipped runs
  are left out. The one failed PR check was the deliberate enforcement demo
  for #23 (PR #81).

## Current snapshot

Measured 1 Nov 2026 from the GitHub Actions API: all 453 workflow runs from
26 Oct to 1 Nov 2026 23:59 PHT.

| Metric | Value |
|---|---|
| Pull request checks (`Install, lint, build, and test`) | 114 runs: 110 passed, 1 failed (deliberate demo, #81), 3 cancelled by a newer push |
| Pull request check duration (Sprint 3) | Median 13 s, mean 13.8 s, 90th percentile 18 s, max 49 s (110 runs) |
| `main` pipeline with real deploys | Median 133 s (114–146 s, 4 runs): checks ~15 s, staging deploy ~11 s, staging smoke test 35–58 s, production deploy ~11 s, production smoke test 28–47 s |
| Lead time, merge → verified in production | Median 136 s (117–150 s, 4 runs) |
| Production deployments through the pipeline | 5, all on 1 Nov |
| AI review | Runs on every pull request; every review since 27 Oct reports OpenAI HTTP 429 (INC-04), so only its automatic checks run |

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
| 1 Nov 2026 19:46 | [41303385163](https://github.com/Anthonyiwnl/tsek/actions/runs/41303385163) | Merge of PR #94 | 637 s | Failure | Hooks received empty secrets; staging smoke test timed out | INC-05. |
| 1 Nov 2026 20:43 | [41307818998](https://github.com/Anthonyiwnl/tsek/actions/runs/41307818998) | Merge of PR #98 | 631 s | Failure | Same as above | INC-05. |
| 1 Nov 2026 20:53 | [41308583202](https://github.com/Anthonyiwnl/tsek/actions/runs/41308583202) | Merge of PR #58 | 634 s | Failure | Same as above | INC-05. `/health` now reports the commit. |
| 1 Nov 2026 21:05 | [41309599966](https://github.com/Anthonyiwnl/tsek/actions/runs/41309599966) (attempts 1–3) | Merge of PR #96 | 639 s, —, 677 s | Failure | Hooks fired; staging, then production, did not serve the new commit | INC-06: wrong Vercel hook, Render staging and production on the wrong branch. |
| 1 Nov 2026 22:14 | [41309599966](https://github.com/Anthonyiwnl/tsek/actions/runs/41309599966) (attempt 4) | Re-run after fixes | 72 s | Success | **First full deploy: staging and production verified** | Render services had been redeployed by hand just before, so the smoke tests passed quickly. |
| 1 Nov 2026 22:29 | [41316410179](https://github.com/Anthonyiwnl/tsek/actions/runs/41316410179) | Merge of PR #81 | 142 s | Success | Deployed and verified, no manual steps | Lead time 145 s. Backend tests required. |
| 1 Nov 2026 22:50 | [41318214204](https://github.com/Anthonyiwnl/tsek/actions/runs/41318214204) | Merge of PR #83 | 114 s | Success | Deployed and verified | Lead time 117 s. Frontend tests required. |
| 1 Nov 2026 22:59 | [41318916883](https://github.com/Anthonyiwnl/tsek/actions/runs/41318916883) | Merge of PR #67 | 146 s | Success | Deployed and verified | Lead time 150 s. Missing settings now fail the deploy. Closes #13. |
| 1 Nov 2026 23:35 | [41322017475](https://github.com/Anthonyiwnl/tsek/actions/runs/41322017475) | Merge of PR #68 | 123 s | Success | Deployed and verified | Lead time 127 s. Closes #14. |

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
