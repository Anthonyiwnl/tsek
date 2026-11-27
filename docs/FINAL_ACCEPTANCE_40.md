# Issue #40 final acceptance and rehearsal record

Audit date: **27 November 2026 (PHT)**
Branch base: [`main` at `e9fb80af98c2cb7612957dcbb12901cf60ba7fd9`](https://github.com/Anthonyiwnl/tsek/commit/e9fb80af98c2cb7612957dcbb12901cf60ba7fd9)
Issue: [#40 — Run final acceptance and rehearse the demonstration](https://github.com/Anthonyiwnl/tsek/issues/40)

## Result

**Issue #40 is not complete and must remain open.** The tracker-level release-blocker check passes for the audit snapshot below. The public app and safe read-only endpoints are available. The seven-item live acceptance, complete process record, and presentation rehearsal are not established by the evidence available here. No issue checkbox is being marked complete on the basis of this document alone.

This is a record of evidence, not a claim that the team met, rehearsed, or approved anything. The audit made no production data, configuration, secret, or deployment changes.

## Current release snapshot

Read-only checks on 27 November 2026:

| Check | Result | Evidence / limit |
|---|---|---|
| Public frontend | HTTP 200; served `tsek-commit` is `e9fb80af98c2cb7612957dcbb12901cf60ba7fd9` | [Production app](https://tsek-seven.vercel.app). This confirms availability, not signed-in application flows. |
| Production API health | HTTP 200, `status: ok`, backend commit `2cf3f8bcfdfdd900358d7e925997dee740fd31f1` | [`/health`](https://tsek-fl10.onrender.com/health). |
| Production catalogue | HTTP 200; three service types returned | [`/api/document-types`](https://tsek-fl10.onrender.com/api/document-types). Read-only catalogue evidence only. |
| Staging API health | HTTP 200, `status: ok`, backend commit `2cf3f8bcfdfdd900358d7e925997dee740fd31f1` | [`/health`](https://tsek-api-staging.onrender.com/health). No staging settings were changed in this audit. |

GitHub API status on the audit date:

- Issue [#40](https://github.com/Anthonyiwnl/tsek/issues/40) is open and was last updated 15 November 2026. It is the only open issue returned for the repository.
- No pull requests were open at the final status check. Earlier same-day draft PRs for loading states, motion, Filipino language, path routing, history, staff AI agreement, email, privacy, photo/PDF analysis, and flagged-requirement evidence had all been closed without merging. Their closure is not evidence that the work shipped.
- Dependencies [#34](https://github.com/Anthonyiwnl/tsek/issues/34), [#35](https://github.com/Anthonyiwnl/tsek/issues/35), [#36](https://github.com/Anthonyiwnl/tsek/issues/36), [#38](https://github.com/Anthonyiwnl/tsek/issues/38), and [#39](https://github.com/Anthonyiwnl/tsek/issues/39) are closed. Release issue [#41](https://github.com/Anthonyiwnl/tsek/issues/41) and prompt-validation issue [#213](https://github.com/Anthonyiwnl/tsek/issues/213) are also closed.
- [PR #172](https://github.com/Anthonyiwnl/tsek/pull/172) is closed without merge, following the recorded decision that its proposed revision safeguard was not planned for v1.0.0. [PR #221](https://github.com/Anthonyiwnl/tsek/pull/221), documenting staging AI failure drills, merged on 22 November.
- The public repository lists published [`v1.0.0`](https://github.com/Anthonyiwnl/tsek/releases/tag/v1.0.0) and [`v1.1.0`](https://github.com/Anthonyiwnl/tsek/releases/tag/v1.1.0) releases.

**Criterion 2 — pass for the tracked release review at this snapshot:** no other issue or PR remained open, the release and prompt-validation issues were closed, and the recorded owner decisions above classify #172 and #213. This does not certify untracked operational risks. The documented AI evaluation limitations remain in [`AI_FINAL_WRITEUP.md`](AI_FINAL_WRITEUP.md) and [`AI_EVALUATION_FREEZE.md`](AI_EVALUATION_FREEZE.md).

## Seven-requirement acceptance matrix

The linked [AI PROGRESS sprint plan](https://docs.google.com/document/d/1mTKSBYr0hHRpPx4Z7bw_LnE2cheXliboVSehyMURfnI/edit) could not be read in full by this audit: the browser loaded the document title, but its body was not extractable. The 15 November issue update says the document has Sprint 1–4 and Final Submission tabs, but does not enumerate the canonical seven requirements. The following labels are therefore **provisional implementation areas copied from that existing issue update**, not confirmed course requirement wording. In particular, this audit does not treat issues #8–#14 as the seven requirements.

| # | Provisional area from the issue update | Existing evidence | Audit result |
|---|---|---|---|
| 1 | CRUD on a real database | Application implementation and historical deployed CRUD/two-account evidence are linked from [Consultation 2](CONSULTATION_2_EVIDENCE.md). Current production checks covered only frontend availability, API health, and a catalogue GET. | **Not re-verified end to end on the current public deployment.** No production writes were performed. |
| 2 | AI output validated and acted on | Analysis and saved checklist implementation/tests: [PR #152](https://github.com/Anthonyiwnl/tsek/pull/152), [PR #154](https://github.com/Anthonyiwnl/tsek/pull/154), plus the evaluation record in [`AI_EVALUATION_FREEZE.md`](AI_EVALUATION_FREEZE.md). | **Not verified as a complete current deployed upload → analysis → persisted checklist flow.** The staging AI smoke results below exercise the verifier, not this full flow. |
| 3 | Backend API boundary | Architecture and endpoint documentation from [PR #201](https://github.com/Anthonyiwnl/tsek/pull/201); current health and catalogue GET checks passed. | **Partial.** The read-only API routes passed; authenticated/mutating application endpoints were not exercised in this audit. |
| 4 | Frontend/backend wiring and UI states | Deployed application work and automated journey/state evidence are linked from [PR #181](https://github.com/Anthonyiwnl/tsek/pull/181) and [PR #171](https://github.com/Anthonyiwnl/tsek/pull/171). | **Not verified as a complete current deployed user journey.** This audit did not sign in or create test data. |
| 5 | Related database tables | Schema and architecture documentation from [PR #201](https://github.com/Anthonyiwnl/tsek/pull/201); historical migration checks are recorded in the issue thread. | **Partial.** Documentation exists; no database query was made during this audit. |
| 6 | Secrets and environment configuration | Setup and environment guidance from [PR #201](https://github.com/Anthonyiwnl/tsek/pull/201), [`STAGING.md`](STAGING.md), and the repository secret-scan workflow. | **Partial.** Public services are healthy; no secret values were read and no new secret scan was run as part of this audit. |
| 7 | AI and malformed-request error handling | Mocked error coverage [PR #156](https://github.com/Anthonyiwnl/tsek/pull/156), backend hardening [PR #184](https://github.com/Anthonyiwnl/tsek/pull/184), and the merged [staging drill record PR #221](https://github.com/Anthonyiwnl/tsek/pull/221). | **Failure-path evidence exists, but this does not establish every malformed-request and deployed application flow in the canonical seven-item rubric.** |

The issue thread records staging AI checks on 15 November: timeout `504 PROVIDER_TIMEOUT` in [run 43689755236, attempt 1](https://github.com/Anthonyiwnl/tsek/actions/runs/43689755236/attempts/1); missing credentials in [run 43697208548, attempt 2](https://github.com/Anthonyiwnl/tsek/actions/runs/43697208548/attempts/2); invalid credentials in [run 43705725230](https://github.com/Anthonyiwnl/tsek/actions/runs/43705725230); and a successful restoration check in [run 43705725230, attempt 2](https://github.com/Anthonyiwnl/tsek/actions/runs/43705725230/attempts/2). These are historical staging results, not a production failure drill or a substitute for all seven end-to-end checks.

**Criterion 1 — not complete:** the canonical seven-item wording is unavailable here, and there is no evidence that all seven complete flows passed on the currently deployed public application.

## Sprint, process, and metrics evidence

| Artifact | Evidence found | Status |
|---|---|---|
| Sprint plans 1–4 | The issue update reports four sprint tabs in the linked Google Doc. A current audit could not extract the document body. The repository has sprint records, but not four separate plan files. | **Reported available; content and completeness not independently verified.** |
| Sprint 1 retrospective | [`SPRINT_1.md`](sprints/SPRINT_1.md) explicitly records it as missing. | **Missing.** Do not reconstruct it from commits. |
| Sprint 2 retrospective | [`SPRINT_2_RETROSPECTIVE_REVIEW.md`](SPRINT_2_RETROSPECTIVE_REVIEW.md) is explicitly a written review of repository evidence, not meeting minutes. | **Written review exists; team discussion/attendance is not established.** |
| Sprint 3 retrospective | [`SPRINT_3_RETROSPECTIVE_REVIEW.md`](SPRINT_3_RETROSPECTIVE_REVIEW.md) is also a written record-based review, not meeting minutes. | **Written review exists; team discussion/attendance is not established.** |
| Sprint 4 retrospective | [`SPRINT_4.md`](sprints/SPRINT_4.md) contains a retrospective based on repository evidence and says a dated team discussion has not been located. | **Written review exists; team discussion/attendance is not established.** |
| Standups | Sprint 1 and Sprint 4 records say dated standup evidence is missing; the other consultation records also describe standup records as unavailable. | **No dated standup evidence was found.** |
| Board history | Issue #40’s GitHub project field is empty. Issue/PR activity histories exist, but no board-history export or record was found. | **Missing as board evidence.** Issue activity is not relabelled as board history. |
| Metrics | [`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD) records Sprint 1–4 and the final-week snapshot, which ends 15 November 2026 at 15:30 PHT. | **Historical metrics exist; there is no snapshot through this audit date.** |
| PR links | Sprint records, changelog, and consultation evidence link many implementation PRs. | **Substantial links exist; the inaccessible plan prevents confirming a complete four-sprint plan-to-PR mapping.** |

**Criterion 3 — not complete:** at minimum, Sprint 1 retrospective, dated standup evidence, board history, and an independently reviewable course-plan record remain absent or unverified. Reviewer/instructor acceptance of the written retrospective alternatives is not recorded.

## Demonstration and rehearsal evidence

- **AI failure/recovery:** the staging timeout, missing-key, invalid-key, and restoration checks above are recorded and the incident documentation merged in PR #221. These results support the technical drill only.
- **Rollback:** the staging rollback drill is documented in [`ROLLBACK_DRILL.md`](ROLLBACK_DRILL.md), [PR #190](https://github.com/Anthonyiwnl/tsek/pull/190), and [PR #196](https://github.com/Anthonyiwnl/tsek/pull/196). The 14 November record says staging stopped the bad release, production was unaffected, and recovery took 11 minutes.
- **Live deployment:** the read-only checks in this record confirmed current availability and commits. They did not rehearse a narrated merge → staging → production demonstration.
- **Slides, speakers, backup screenshots, and presentation rehearsal:** no complete deck, confirmed speaker assignments, screen-by-screen backup set, or observed rehearsal record was found in the repository or issue evidence reviewed.

**Criterion 4 — not complete:** technical drills and a current availability check are recorded, but presentation materials, assignments, backup screenshots, and rehearsal confirmation are missing.

## Exact remaining work

1. Provide the authoritative seven requirement statements or confirm the exact list from the course owner. Do not substitute GitHub issues #8–#14 without that confirmation.
2. Run and record each full requirement flow on the required deployed target with approved synthetic accounts/data. Avoid production writes unless the owner explicitly provides a safe test plan; staging-only checks may not satisfy a requirement that explicitly demands public production evidence.
3. Supply real dated standup/board artifacts if they exist. If they do not, get the reviewer/instructor’s written decision on acceptable alternatives; do not create historical records.
4. Supply the presentation deck, actual speaker assignments, backup screenshots, and evidence of a real rehearsal covering AI failure, live deployment, and rollback.
5. Refresh the metrics snapshot through the agreed sprint/release cutoff and link the complete plan-to-PR map.

Until these items are resolved and independently evidenced, leave issue #40 open. This document is process evidence for the partial audit only and does not close the issue.
