# TSEK CI/CD Pipeline Metrics

## Purpose

This document records the performance and reliability of the
TSEK continuous integration and deployment pipeline.

## Current snapshot

Measured 27 Oct 2026 from the GitHub Actions API: all 117 workflow runs
between 13 and 27 Oct 2026. Durations are wall-clock time from run start
to run completion. Times are Philippine time (UTC+8).

| Metric | Value |
|---|---|
| Pull request checks (`CI and deployment`) | 44 runs: 43 passed, 1 cancelled by a newer push, 0 failed |
| Pull request check duration | Median 15 s, mean 16 s, 90th percentile 21 s. All three use the same 40 runs: the 43 passed runs minus the 3 outliers below. |
| `main` pipeline runs | 6 runs, 6 passed, 26–49 s each |
| Issue-link check (`PR links an issue`) | 23 runs: 18 passed, 5 failed because the PR had no `Closes #N`; each failure blocked merging until fixed |
| AI review | 20 runs: 16 passed, 3 skipped (draft PRs), 1 cancelled by a newer push |
| Frontend bundle audit | 19 runs, 19 passed, median 13 s |
| Production deployments | 0. On a push to `main`, staging runs only after the checks pass, and production only after staging succeeds. In every run so far the Vercel and Render trigger steps were skipped because the deploy hooks are not configured yet (tracked in #13). |

Three pull request check runs on PR #3 on 19 Oct took 19–31 minutes
wall-clock ([39279458172](https://github.com/Anthonyiwnl/tsek/actions/runs/39279458172),
[39282439229](https://github.com/Anthonyiwnl/tsek/actions/runs/39282439229),
[39284248028](https://github.com/Anthonyiwnl/tsek/actions/runs/39284248028)).
Every other pull request check run finished in under 30 seconds, so these
three are left out of the duration figures above. Investigate if a run takes this long again.

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
