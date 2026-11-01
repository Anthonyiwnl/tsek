# DevOps Rubric Status

Tracks the DevOps Engineer's individual CI/CD rubric (100 points) from the
[CSP221A course guide](https://csp221a.vercel.app/#rubrics) against
evidence in this repository. Updated 1 Nov 2026 (end of Sprint 3).

Status key: ✅ evidence in place · 🟡 partial · ❌ not started.
"PR #N" means written and waiting for review, not yet on `main`.

| Criterion | Pts | Status | Evidence now | Next action |
|---|---|---|---|---|
| Pipeline design and coverage | 15 | 🟡 | PR checks: issue link, install, lint, type check, build, frontend and backend tests (`ci.yml`), bundle audit, AI review. `main`: checks → staging deploy → staging smoke test → production deploy → production smoke test (`deploy-main.yml`, `deploy.yml`) | Merge `PIPELINE.md` and diagram (PR #92) and the security stage (PR #84) |
| Automation and quality gates | 10 | ✅ | Every merge deploys with no manual steps (5 production deploys on 1 Nov). `main` protection: PR required, 1 approval, no self-approval of the last push, stale approvals dismissed, branch up to date, conversations resolved, admins included. Required checks: `Install, lint, build, and test`, `PR links an issue`. Missing deploy settings fail the deploy (#67) | Make the security checks required after PR #84 merges; one issue per PR (PR #82) |
| Optimization with measured results | 20 | 🟡 | Baselines: PR check median 13 s; `main` 133 s with per-stage breakdown (`OPTIMIZATION_LOG.MD`) | Apply the candidates one at a time with before and after numbers (#37) |
| Environments and secrets | 10 | ✅ | Separate `staging` and `production` GitHub environments, Vercel projects, Render services and Neon branches; per-environment hook secrets; only the two hook secrets reach deploy jobs (#96) | Separate OpenAI keys with a spend cap on staging; `.env.example` for every app (PR #85); full-history secret scan (PR #84) |
| AI-aware pipeline practices | 10 | 🟡 | AI review never blocks merges and runs on every PR; bundle audit blocks frontend access to OpenAI or the database | Mocked LLM tests in CI (#32); eval on prompt changes (#31); daily AI smoke test (PR #90); fix the AI review key (INC-04) |
| Release and rollback | 10 | 🟡 | Runbook and rollback workflow (PR #88); release workflow and changelog (PR #89) | Merge both; timed rollback drill (#38); tag `v1.0.0` (#41) |
| Reliability and incidents | 10 | 🟡 | 7 incidents with postmortems (`INCIDENTS.MD`); INC-02, INC-05, INC-06 and INC-07 resolved with evidence; the staging gate stopped every bad release in INC-05 and INC-06 | Close INC-03 (retire Hero's Vercel projects) and INC-04 (AI review key) |
| Metrics, docs, and reporting | 10 | 🟡 | Sprint 1–3 rows from the Actions API, including first lead time (median 136 s), failed deploys and time to recover (`PIPELINE_METRICS.MD`); runbook and `PIPELINE.md` in review | Sprint 4 row before Consultation 4; merge PR #88 and #92 |
| Live performance | 5 | ❌ | — | Rehearse narrating a live merge → staging → production run and a rollback |

## Sprint goals for the DevOps Engineer

| Sprint | Course goal | Status |
|---|---|---|
| 1 | CI on every PR; first deployment to a live URL triggered by the pipeline | ✅ CI since 19 Oct; first pipeline deploy 1 Nov (#13 closed) |
| 2 | API tests in the pipeline; every merge deploys automatically; staging taking shape | ✅ Backend and frontend tests required (#23, #70); every merge deploys through staging (since 1 Nov) |
| 3 | Mocked LLM tests in CI; eval set; AI-aware pipeline practices | 🟡 Waits on the AI feature (#27, #31, #32); daily AI smoke test in PR #90 |
| 4 | Measured optimizations; security checks; tagged release; rollback tested; docs complete | ❌ (#37, #38, #41); security, release, runbook and docs PRs are in review |

## Critical path

1. Merge the DevOps PRs in review, one at a time: #84 → #82 → #88 → #92 →
   #85, #86, #87, #89, #90, #91.
2. First measured optimization (merged deploy jobs), then the next.
3. Rollback drill on staging with the rollback workflow, timed (#38).
4. Mocked LLM tests and evals once the AI feature lands (#32, #31).
5. `v1.0.0` release (#41).
