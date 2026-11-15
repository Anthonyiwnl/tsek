# DevOps Rubric Status

Tracks the DevOps Engineer's individual CI/CD rubric (100 points) from the
[CSP221A course guide](https://csp221a.vercel.app/#rubrics) against
evidence in this repository. Updated 15 Nov 2026, after the `v1.1.0` release.

Status key: ✅ evidence in place · 🟡 partial · ❌ not started.

| Criterion | Pts | Status | Evidence now | Remaining |
|---|---|---|---|---|
| Pipeline design and coverage | 15 | ✅ | Every PR: issue link, install, lint, type check, build, frontend and backend tests (`ci.yml`), dependency audit and full-history secret scan (`security.yml`), backend container test against PostgreSQL (`container.yml`), bundle audit, AI and Claude review. `main`: checks → staging deploy and smoke test → production deploy and smoke test (`deploy-main.yml`). Tags: `release.yml`. Stages, purposes and triggers are explained in [`PIPELINE.md`](../PIPELINE.md) with a diagram | — |
| Automation and quality gates | 10 | ✅ | Merging is the deploy; no manual steps. Branch protection: PR required, 1 approval, no self-approval of the last push, branch up to date, conversations resolved, required checks. A missing deploy setting fails the deploy (#67). The staging gate stopped the bad releases in INC-05, INC-08 and INC-09 | — |
| Optimization with measured results | 20 | ✅ | [`OPTIMIZATION_LOG.MD`](OPTIMIZATION_LOG.MD): optimization 1 (job start-up 20 s → 12 s), npm cache (no gain, not kept), optimization 3 (no measurable gain), optimization 4 (merges that change no service 161 s → 84 s). The #167 follow-up is now measured on real merges: 17 docs- and data-only merges rebuilt nothing (median 73 s), and a test-only merge (#191) took 60 s ([`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD)) | Add the final-week figures to the optimization log too |
| Environments and secrets | 10 | ✅ | Separate `staging` and `production` GitHub environments, Vercel projects, Render services and Neon branches; per-environment secrets; `.env.example` for every app; full-history secret scan; separate OpenAI projects and keys per environment; the staging project only allows four small models | The OpenAI project spend limits are alerts, not hard caps: spending past them is not blocked. Revoke the unused staging key and temporary eval keys |
| AI-aware pipeline practices | 10 | ✅ | Mocked LLM tests in CI, with prompt and schema fingerprints that fail CI on an unversioned change (#156); evaluation harness on prompt changes (`eval-harness.yml`); daily AI smoke test on staging (#90); kill switch documented for both environments (#209); the AI provider never blocks a deploy. A live evaluation found a prompt-injection weakness, and it was fixed and released the same day (INC-10, #214) | The eval harness's live run needs an `OPENAI_EVAL_API_KEY` secret |
| Release and rollback | 10 | ✅ | [`v1.0.0`](https://github.com/Anthonyiwnl/tsek/releases/tag/v1.0.0) and [`v1.1.0`](https://github.com/Anthonyiwnl/tsek/releases/tag/v1.1.0) published by the Release workflow from [`CHANGELOG.md`](../CHANGELOG.md), gated on a passing deploy. Rollback drill on 14 Nov: staging stopped the bad release, recovered in 11 min ([`ROLLBACK_DRILL.md`](ROLLBACK_DRILL.md), INC-09). Production verified after the release (#41) | Show a rollback live if asked |
| Reliability and incidents | 10 | ✅ | 10 incidents with postmortems in [`INCIDENTS.MD`](INCIDENTS.MD), including the planned drill (INC-09) and the prompt-injection fix (INC-10); hourly uptime monitor and SLOs (#120) | INC-03 (retire Hero's old Vercel projects) is mitigated, not closed |
| Metrics, docs, and reporting | 10 | ✅ | Sprint 1–4 and final-week rows in [`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD); runbook ([`RUNBOOK.md`](RUNBOOK.md)), `PIPELINE.md`, maintenance plan, setup, architecture, database and API docs (#201) | Update the metrics row again if anything merges before the final presentation |
| Live performance | 5 | 🟡 | Runbook §5 has the Demo Day checklist and live-deploy rehearsal | Rehearse narrating a merge → staging → production run and a rollback, and record it in the video |

## Sprint goals for the DevOps Engineer

| Sprint | Course goal | Status |
|---|---|---|
| 1 | CI on every PR; first deployment to a live URL triggered by the pipeline | ✅ CI since 19 Oct; first pipeline deploy 1 Nov |
| 2 | API tests in the pipeline; every merge deploys automatically; staging taking shape | ✅ Backend and frontend tests required; every merge deploys through staging to production |
| 3 | Mocked LLM tests in CI; eval set; AI-aware pipeline practices | ✅ Mocked AI failure tests (#156), evaluation sets and harness, daily AI smoke test |
| 4 | Measured optimizations; security checks; tagged release; rollback tested; docs complete | ✅ Optimizations measured (#37), security checks required, `v1.0.0` and `v1.1.0` released, rollback drill passed (#38), docs complete (#39) |

## Remaining before the final presentation

1. Record the video: the pipeline on a real merge, the staging gate, the
   rollback drill evidence, the two releases and INC-10.
2. Final acceptance and rehearsal (#40).
3. Revoke unused OpenAI keys.
