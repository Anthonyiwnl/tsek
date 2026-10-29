# DevOps Rubric Status

Tracks the DevOps Engineer's individual CI/CD rubric (100 points) from the
[CSP221A course guide](https://csp221a.vercel.app/#rubrics) against
evidence in this repository. Updated 29 Oct 2026 (Sprint 3).

Status key: ✅ evidence in place · 🟡 partial · ❌ not started

| Criterion | Pts | Status | Evidence now | Next action |
|---|---|---|---|---|
| Pipeline design and coverage | 15 | 🟡 | `ci.yml`, `deploy.yml`, `pr-issue-link.yml`, `ai-review.yml`, `bundle-audit.yml`; `docs/CI_CD.md` | Write `PIPELINE.md` (each stage, why, trigger) and a pipeline diagram. Add a security stage (dependency audit, secret scan). |
| Automation and quality gates | 10 | 🟡 | `main` protection verified 29 Oct: PR required, 1 approval, stale approvals dismissed, last push re-approved, required checks `Install, lint, build, and test` and `PR links an issue`, branch must be up to date, conversations resolved, admins included, force pushes and deletion blocked | Automated deployment is not operational (INC-02): the jobs run but pass while skipping every hook and check. Remove the off-pipeline production path (INC-03). |
| Optimization with measured results | 20 | 🟡 | Baseline in `docs/OPTIMIZATION_LOG.MD` | One change at a time once real deploys and tests land; log before and after. |
| Environments and secrets | 10 | 🟡 | `staging` and `production` GitHub environments exist; `backend/.env.example` | Configure hooks and URLs per environment (#13); separate keys per environment; add `frontend/.env.example`. |
| AI-aware pipeline practices | 10 | 🟡 | AI review never blocks merges and skips drafts, but has not completed a review yet (INC-04) | Mocked LLM tests in CI (#32); eval set runs when prompts or AI code change (#31); nightly live smoke test; spend caps on non-production keys. |
| Release and rollback | 10 | ❌ | — | Rollback runbook; tagged `v1.0.0` with changelog; rollback shown live (#38). |
| Reliability and incidents | 10 | 🟡 | `docs/INCIDENTS.MD`: INC-01 to INC-04 | Close INC-02 to INC-04 only after each fix is in place and verified on a real run; a postmortem alone does not close an incident. |
| Metrics, docs, and reporting | 10 | 🟡 | Sprint metrics log in `docs/PIPELINE_METRICS.MD` | Fill the Sprint 3 row again before Consultation 3, and Sprint 4 before Consultation 4. |
| Live performance | 5 | ❌ | — | Rehearse narrating the live deploy challenge stage by stage. |

## Sprint goals for the DevOps Engineer

| Sprint | Course goal | Status |
|---|---|---|
| 1 | CI on every PR; first deployment to a live URL triggered by the pipeline | CI ✅ · pipeline deploy ❌ (INC-02) |
| 2 | API tests in the pipeline; every merge deploys automatically; staging taking shape | Backend tests run in CI ✅ · auto-deploy ❌ · staging jobs exist, not connected 🟡 |
| 3 | Mocked LLM tests in CI; eval set; AI-aware pipeline practices | ❌ (#31, #32) |
| 4 | Measured optimizations; security checks; tagged release; rollback tested; docs complete | ❌ (#37, #38) |

## Critical path

1. Connect hosting so a merge deploys for real (#13, #58). Deploy counts,
   lead time, smoke tests, rollback and deploy-stage optimizations all need
   a live pipeline deploy.
2. Mocked LLM tests and the eval workflow (#32, #31). These run in CI with
   mocked or synthetic inputs and can proceed in parallel with step 1.
3. `PIPELINE.md`, diagram and rollback runbook.
4. Optimizations with numbers, then `v1.0.0`.
