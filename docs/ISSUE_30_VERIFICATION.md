# Issue #30: replacement and reanalysis

## Implemented behavior

The authenticated application details screen uploads a plain text file, starts
analysis, and reloads files, results, and the checklist from the API. Choosing an
existing document replaces its contents while preserving its file ID and
application link. The replacement starts fresh analysis through the same UI
flow. This screen provides the upload controls needed by #30 while #29 remains
an independently tracked frontend task; it does not close #29.

Each file has a monotonically increasing `revision` and `analysis_generation`.
Replacement uses `PUT /api/applications/:id/files/:fileId` with a quoted revision
in `If-Match` (for example, `"3"`). The backend validates the same size, media
type, signature, filename, owner and draft constraints used by uploads. An atomic
conditional update accepts only the displayed revision. A repeated/stale request
returns `409 FILE_CHANGED` instead of overwriting a newer document. Replacement
does not consume another slot in the ten-file limit.

Saving a replacement immediately invalidates its earlier results. Starting any
analysis reserves a new generation before calling the provider. Persisting the
result requires the same owner, draft application, service, file revision and
generation. A delayed response from a replaced file or an earlier retry returns
`409 APPLICATION_CHANGED`; it cannot restore an obsolete checklist decision.
The checklist selects only the accepted file revision and current generation.
History remains owner-scoped and explicitly identifies current results.

File acceptance and analysis are two requests, not one distributed transaction.
If analysis fails or the connection is interrupted between requests, the saved
replacement remains, earlier results stay excluded, and the user can refresh and
retry analysis without uploading the file again. Failed validation before file
acceptance leaves its previous contents/results unchanged. The UI hides its
previous checklist during mutation and ignores late refresh responses.

## Automated verification

`npm run check` passed on 8 November 2026: frontend lint/typecheck/build, 50 frontend tests (22 API + 28 UI), backend lint and 206 backend tests. `git diff --check` also passed.

All provider responses are mocked; tests do not call OpenAI. PostgreSQL-backed
integration tests use PGlite and real HTTP routes to cover:

- Replacement linkage, revision advancement and refreshed checklist decisions.
- Invalid/empty uploads leaving the accepted version untouched.
- Duplicate/stale replacement rejection and replacement at the ten-file limit.
- Owner isolation and non-draft rejection.
- Provider failure followed by analysis retry of the saved replacement.
- A delayed old analysis finishing after replacement and fresh analysis.
- Out-of-order retries of the same file, including a newer failed attempt.
- Raw upload headers, bearer authentication and quoted revision preconditions.
- UI replacement, automatic analysis, refreshed persisted results, conflict
  recovery and analysis retry without another replacement.

Migration `006_file_revisions.sql` is additive. Existing files and analyses start
at revision 1 / generation 0; the existing latest-result ordering is preserved.
Migration and seed repeatability checks include the new migration.

## Release and live acceptance — pending

This document records implementation and automated evidence, not a claim that
unmerged code is deployed. Keep #30 open until the PR receives teammate review,
merges through the protected main branch, and the normal staging/production
pipeline succeeds. Do not bypass review or deploy a feature branch to production.

Before deploying the new backend, apply the additive migration to staging and
then production using the existing database migration task (`npm run db:migrate
--prefix backend`) against each environment's configured database. Do not put
connection strings in PRs or logs. The current server does not run migrations
at startup, so this is a release prerequisite, not an automatic deploy assumption.
Old backend code can continue using the additive schema during rollout.

After deployment, record the reviewed PR, deployment run, commit and actual
results for this synthetic-data acceptance flow:

1. In the public React UI, create a test draft and upload a synthetic plain text
   document with complete fields. Confirm the saved result/checklist after reload.
2. Replace that document with a different/incomplete synthetic document. Confirm
   the same application/file link, increased revision, fresh extracted fields,
   and exclusion of the earlier complete decision after reload.
3. Retry analysis and repeat a stale replacement request. Confirm that only the
   current attempt contributes and a stale revision receives a conflict.
4. Verify controlled provider-failure recovery in an isolated/mock environment;
   do not deliberately disable production dependencies to cause an outage.
5. Verify another test account cannot read, replace or analyze the test file.
6. Clean up only the synthetic records with the user's authorization and attach
   the results. No live result or reviewer approval is asserted in advance.

Current analysis supports `text/plain` only, with 1–10,000 text characters. The
existing storage API also accepts PDF/JPEG/PNG; this change does not add OCR.
