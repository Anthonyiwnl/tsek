# Consultation 3 evidence — issue #33

Audit date: **8 November 2026 (PHT)**. Planned Sprint 3: **26 October–1 November 2026**.
This is a current verification record; it does not backdate delivery or meetings.

**Status: preparation and baseline checks complete; full live acceptance pending.**
Do not close [#33](https://github.com/Anthonyiwnl/tsek/issues/33) from this document alone.

## Acceptance and evidence status

| Requirement | Verified evidence | Remaining work |
|---|---|---|
| Synthetic file completes upload, extraction, validation, persistence and UI display | Merged backend integration/evaluation work in [#154](https://github.com/Anthonyiwnl/tsek/pull/154), [#155](https://github.com/Anthonyiwnl/tsek/pull/155); replacement implementation in [#172](https://github.com/Anthonyiwnl/tsek/pull/172) | #172 is open/unmerged. Run the authenticated staging UI flow after reviewed release; attach synthetic record IDs, saved results and screenshots. |
| Provider failure and recovery demonstrated safely in the deployed environment | Eight local failure/control scenarios passed; one real staging `/api/verify` baseline passed | No deployed outage was induced. Coordinate the staging-only failure/recovery sequence below with Axel and Anthony. A successful baseline is not a recovery demonstration. |
| Environment-scoped keys; no document/secret logging | Separate staging/production service identities and frontend URLs verified; source logging review and limited runtime-log sample found no document text or secret values | Confirm distinct restricted OpenAI project/key bindings and staging budget without sharing their values. Inspect the bounded live-test log window after the full drill. Separate service names alone do not prove distinct keys. |
| Evaluation, deployment, PR, standup, retrospective and pipeline evidence | Links below; [written retrospective](SPRINT_3_RETROSPECTIVE_REVIEW.md) prepared at the user's request | Actual standup records unavailable. Written review is an alternative requiring reviewer/instructor acceptance. Full demo recording/link and final live evidence remain pending. |

| Completion evidence | Status |
|---|---|
| Implementation/process branch and reviewed PR | Issue #33 branch: `33-consultation-3-evidence`; this evidence PR requires teammate review. #172 is a separate dependency. |
| Passing checks and validation | Local failure drill, evaluation harness control, existing deployed pipeline and #172 checks linked below. |
| Deployment and affected behavior checked live | Current deployed baseline verified; complete document/replacement/failure/recovery UI flow not yet verified. |

## Verified deployment baseline

Read-only checks confirmed the intended, previously authorized Render workspace:
`cromwell's Workspace` (`tea-csp7pajgbbvc73d1317g`). Both services use `main`,
automatic deploy is off, and neither service is suspended.

| Environment | Frontend | Backend | Backend release observed |
|---|---|---|---|
| Staging | [tsek-staging](https://tsek-staging.vercel.app) | [staging health](https://tsek-api-staging.onrender.com/health) | `dc0feda7b779666525e73a4730f408ca125a839a` |
| Production (health read only) | [tsek](https://tsek-seven.vercel.app) | [production health](https://tsek-fl10.onrender.com/health) | `dc0feda7b779666525e73a4730f408ca125a839a` |

- Staging Render service: `srv-dbjgp0ajnfac73fuvvv0`.
- Production Render service: `srv-dbfpmoqjnfac738fg8mg`.
- Current staging deploy: `dep-dbnkdaec6qcc73e5089g`, status `live`.
- [Deployed baseline pipeline](https://github.com/Anthonyiwnl/tsek/actions/runs/42387515057): checks, staging and production jobs succeeded. Render deploy and database checks ran successfully. Frontend deploy steps were skipped for this backend-only change; the pipeline checked the retained frontend through its deployment-plan logic. This is not a claim that every frontend was rebuilt at this commit.
- The staging applications URL displayed its sign-in page. No authenticated upload or results were observed in that browser session.
- [#172 checks](https://github.com/Anthonyiwnl/tsek/actions/runs/42454955481) passed, but that branch is not the deployed baseline. Do not conflate the two releases.

## Checks actually run during this audit

`npm run check` passed on this documentation branch: **201 backend + 46 frontend
checks/tests**, including frontend lint/typecheck/build and backend lint. The
separate evaluation-harness suite passed 13 tests. These are current-main counts;
#172's 206 backend + 50 frontend tests belong to its separate implementation branch.


### Local provider failure drill

Command: `npm run drill:ai --prefix backend`.

| Scenario | HTTP | Code | Result |
|---|---|---|---|
| Normal control | 200 | None | Pass |
| Missing credentials | 503 | `MISSING_CREDENTIALS` | Pass |
| Timeout | 504 | `PROVIDER_TIMEOUT` | Pass |
| Unreachable provider | 502 | `PROVIDER_UNAVAILABLE` | Pass |
| Provider HTTP 500 | 502 | `PROVIDER_ERROR` | Pass |
| Provider HTTP 429 | 502 | `PROVIDER_ERROR` | Pass |
| Truncated response | 502 | `INVALID_PROVIDER_RESPONSE` | Pass |
| Non-JSON response | 502 | `INVALID_PROVIDER_RESPONSE` | Pass |

These tests used a local fake provider, no real key, and no paid model calls.
Each scenario also checks health/catalogue availability and sanitized responses.

### Deployed staging baseline

Command:

```powershell
npm run drill:ai --prefix backend -- --url https://tsek-api-staging.onrender.com --expect OK
```

Run during **14:37–14:39 PHT, 8 November 2026**. One synthetic request returned
HTTP 200 with the required non-empty result/model; health and catalogue checks
passed. No secret or provider-internal sentinel appeared in the checked response.
This exercises `/api/verify`, not authenticated document persistence or UI results.
No Render environment value, deployment, credential or production setting was
changed for this audit. No application record was created, so cleanup was unnecessary.

### Evaluation evidence and limits

- [Merged #31 evaluation PR #155](https://github.com/Anthonyiwnl/tsek/pull/155),
  [production-contract evaluation report](DOCUMENT_ANALYSIS.md),
  [17 expected synthetic cases](../backend/test/fixtures/document-evaluation-v1/expected.json).
- The merged evaluation replayed mocked observations through upload, extraction,
  storage and checklist routes. Its 17 supplied samples and eight supplemental
  cases are deterministic contract evidence, not measured live model accuracy.
- Five recorded human-judgment differences: passport without address marked
  incomplete; PhilSys/electricity-bill titles unmatched; a bill in another person's
  name accepted; expired license accepted. Do not describe these as solved by #30.
- [Mocked failure-flow PR #156](https://github.com/Anthonyiwnl/tsek/pull/156) and
  [failure drill guide](AI_FAILURE_DRILL.md) cover malformed/timeout/provider errors.
- The separate [model-comparison harness](../scripts/eval/README.md) uses 20
  cases and a different prompt. In this audit, its **13 tests passed** and
  `node scripts/eval/compare-models.mjs --models mock:perfect --no-save`
  returned 20/20 controls with 100% mocked scores. Those scores validate the
  harness only; no cloud/local model comparison or live extraction accuracy is claimed.

### Logging and environment audit limits

Application/auth error logging records request ID, event, error name/code rather
than request bodies, Authorization headers, provider messages or document fields.
The provider/extractor code does not log its payload. CI failure tests assert
sanitization. A 30-entry staging application-log sample, ending at the observed
06:37 UTC startup, contained startup/platform messages and no document text or
secret values. This limited sample cannot establish an absence across all logs.
No raw runtime logs or secrets are copied into this document.

GitHub staging variables resolve to the staging URLs in the table above.
Confirm OpenAI project-level permissions, key separation and budget in the owner
dashboard; the available Render connector does not expose a safe key-binding
attestation. Do not paste keys into screenshots, issue comments or this file.

## Controlled live acceptance sequence — not yet executed

1. Obtain teammate review of #172, apply its additive migration to the correct
   staging/production database branches, and use the protected-main pipeline.
   Record the new release hashes and pipeline run before testing #30 behavior.
2. Francis coordinates a current test window with Axel (#31) and Anthony (#32).
   Record their actual acknowledgment, test time and responsibilities; do not
   invent a historical standup or claim they participated before acknowledgment.
3. Sign in privately to **staging**, using an account in the staging Auth branch.
   Use only clearly synthetic documents from the versioned evaluation set.
4. In the UI, upload/analyze a synthetic document. Reload; correlate application,
   file and analysis IDs and sanitized metadata with owner-scoped stored results.
   Check extracted values and checklist decisions, not just the HTTP status.
5. Replace the file and reanalyze. Verify the same application/file link, new
   revision and refreshed checklist; confirm earlier complete results stay excluded.
6. Record the exact existing staging `OPENAI_TIMEOUT_MS` setting, including whether
   it is absent. Leave the staging API key unchanged. Set only staging timeout to
   `1`, deploy and wait for `live`, then demonstrate one controlled failed analysis
   and healthy non-AI endpoints. Never run this step on production.
7. Immediately restore the exact prior timeout configuration, deploy and verify
   `live`. Retry analysis on the saved synthetic file; confirm successful persisted
   results and UI recovery after reload. If anything fails, restoration takes
   precedence over collecting further evidence. Do not replace/delete a real key.
8. Review the bounded runtime-log window for the synthetic marker, document fields,
   bearer tokens and key patterns; record only the check outcome and time window.
   Confirm key scoping in the owner's dashboard without exposing values.
9. Capture a short synthetic-data demo and supply its real link. Clean up only
   identified synthetic records with authorization and record the cleanup outcome.
10. Attach actual results and obtain reviewer acceptance of the written
    retrospective alternative before checking the corresponding process criterion.

## Live run record to complete

| Evidence | Actual result |
|---|---|
| Agreed window / Axel and Anthony acknowledgment | Pending |
| Reviewed release PR / deployed commit / pipeline | Pending #172 release |
| Application / file / analysis IDs | Pending |
| UI upload, reload, replacement and fresh checklist | Pending |
| Deployed failure response / continued health | Pending |
| Exact configuration restoration / recovery response | Pending |
| Owner-scoped persistence checks | Pending |
| Log window and secret-scope attestation | Pending |
| Demo URL / synthetic cleanup | Pending |
| Standup evidence or accepted alternative | No historical records supplied; reviewer decision pending |
