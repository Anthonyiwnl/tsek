# Consultation 2 / issue #25 verification record

Audit date: 7 November 2026 (PHT). Source baseline: `e2617f68be5ac21a7ebdca4ed97732c36e97541a`.

**Status: incomplete; keep [issue #25](https://github.com/Anthonyiwnl/tsek/issues/25) open.**
Implementation, peer review, automated checks and deployment are verified.
Authenticated live CRUD and actual team process records remain unverified.
Checked boxes alone are not acceptance evidence.

## Acceptance matrix

| Requirement | Evidence | Result / limit |
|---|---|---|
| Public React create/read/edit/delete persists in PostgreSQL | Merged frontend #59, #54, #55; backend #114, #147; automated tests below | Implemented and tested automatically. Live authenticated UI and hosted PostgreSQL round trip still pending. |
| Invalid input and another user's records handled safely | Backend application tests cover invalid inputs, owner isolation, draft-only mutations, deletion and rollback; live missing/invalid token probes return 401 | Automated coverage verified. Live two-account owner-isolation exercise pending. |
| Reviewed merge passes API tests and deploys automatically | Peer approvals and main deployment run below | Verified for the audited merge. Deployment smoke tests cover availability/version/catalogue, not authenticated CRUD. |
| Plan, 2–3 actual standups, retrospective, board, metrics and demo links ready | Existing plan link, issue tracker, metrics and Sprint 1 record below | Incomplete: actual Sprint 2 standup and retrospective links and consultation recording are not in the repository/issue evidence inspected. Plan content could not be accessed. |

## Implementation and peer review

GitHub review records show approval by `Anthonyiwnl` for each of these merged PRs:

| Work | Branch | Reviewed PR |
|---|---|---|
| Sign-in and creation (#18) | `codex/hero-complete-application-management` | [#59](https://github.com/Anthonyiwnl/tsek/pull/59) |
| List and details (#19) | `codex/hero-application-workflows` | [#54](https://github.com/Anthonyiwnl/tsek/pull/54) |
| Draft edit and confirmed delete (#20) | `codex/hero-edit-delete-applications` | [#55](https://github.com/Anthonyiwnl/tsek/pull/55) |
| Backend draft update/delete (#17) | `backend-17-update-delete` | [#147](https://github.com/Anthonyiwnl/tsek/pull/147) |
| CRUD failure/ownership tests (#22) | `issue-22-crud-tests` | [#113](https://github.com/Anthonyiwnl/tsek/pull/113) |

Create/read backend: [#114](https://github.com/Anthonyiwnl/tsek/pull/114).
Dependencies #18, #19, #20, #23 and #24 are closed, but their issue-body evidence checkboxes are mostly empty; closure alone was not used as proof.

## Passing automated validation

[Main run 42381844985](https://github.com/Anthonyiwnl/tsek/actions/runs/42381844985)
for merge `e2617f6` completed successfully:

- [Install, lint, build and test](https://github.com/Anthonyiwnl/tsek/actions/runs/42381844985/job/128430944340): frontend lint/build, 21 Node tests, 25 UI tests across 3 files; backend lint and 153 tests. Zero failing tests.
- [Staging deploy and smoke test](https://github.com/Anthonyiwnl/tsek/actions/runs/42381844985/job/128431087761): frontend hook executed; backend correctly skipped as unchanged; expected backend/frontend versions and database-backed endpoint passed.
- [Production deploy and smoke test](https://github.com/Anthonyiwnl/tsek/actions/runs/42381844985/job/128431299255): same checks passed after staging.

Backend `backend/test/applications.test.js` checks create/read persistence using PGlite (embedded PostgreSQL), two-owner isolation, malformed IDs, rejected client-supplied ownership, invalid bodies, draft-only edits/deletes, database failure sanitization, CORS mutation preflight and transaction rollback.
Frontend `frontend/tests/workspace.test.tsx`, `create.test.tsx`, `auth.test.tsx` and `application-api.test.js` cover UI creation, persisted re-read after edit, delete cancellation/error/success, current identity/token use and stale-request handling. These UI tests mock the network.

**Do not relabel embedded-database or mocked-network tests as hosted live acceptance.**

Independent local rerun on the audited baseline: `npm run setup` then
`npm run check` completed with exit 0 on Node 24.21.0. Counts matched CI:
21 frontend Node tests, 25 UI tests, 153 backend tests. `git diff --check` passed.
Existing warnings remain: the frontend auth module triggers an oxlint ref-access
warning; the local build lacks Vercel's commit environment variable; installation
reported 7 low frontend and 4 moderate backend audit findings. These were not
silently remediated with forced dependency upgrades during an evidence-only audit.

## Independent live read-only checks

Requests made on 7 November 2026 without a user session:

| Target | Observed result |
|---|---|
| [Production React UI](https://tsek-seven.vercel.app/#/applications) | Sign-in form rendered. Frontend HTML returned 200 and reported `e2617f68be5ac21a7ebdca4ed97732c36e97541a`. |
| [Staging health](https://tsek-api-staging.onrender.com/health) | 200; backend commit `ad7854648a3330b02bdc791ea9cab1fcf335ad1b` |
| [Production health](https://tsek-fl10.onrender.com/health) | 200; backend commit `7311fa88ca8234b2398e2bc30407ce8c66fe161d` |
| Staging and production `GET /api/document-types` | 200; 3 records on each |
| Staging and production `GET /api/applications`, no token | 401; `MISSING_BEARER_TOKEN` |
| Production `GET /api/applications`, deliberately invalid token | 401; `INVALID_BEARER_TOKEN` |

Both served backend commits have **no differences under `backend/`** against the audited main baseline (`git diff --quiet <served> <baseline> -- backend/`, exit 0 for each).
The deploy-plan optimization in #151 deliberately retains unchanged services; different service SHAs are therefore expected here.
These checks prove availability, release content equivalence and unauthenticated rejection, not a valid JWT/Auth branch mapping or authenticated CRUD.

## Remaining live acceptance and demo script

Use two authorized test accounts and synthetic records. Never publish passwords, bearer tokens, database URLs or real citizen data.

1. Sign in through the public React UI. Record environment, frontend/backend versions and test time.
2. Create one disposable draft with purpose `Issue 25 acceptance test`; record its returned ID. Refresh the page and reopen it.
3. Edit the purpose to `Issue 25 acceptance test edited`; refresh and verify it persists. Use a narrowly scoped read-only PostgreSQL query for this test ID to corroborate persisted values, if database access is available.
4. Attempt invalid required input; verify no saved record and readable field errors. Exercise a malformed/invalid API request with a valid test-account token and record sanitized status/code without the token.
5. With account B, verify account A's test record is absent from the list and inaccessible by direct ID, including read/update/delete attempts. Confirm account A's record remains unchanged. Use only the synthetic record created for this audit.
6. In account A, open Delete and cancel; verify the record remains. Confirm deletion of that disposable draft; refresh and verify it stays absent, and corroborate its removal in PostgreSQL.
7. Capture sanitized screenshots or a short demo recording and link them here. Repeat necessary acceptance on staging with its own test database; do not infer environment isolation from names alone.

No authenticated live acceptance was performed during the initial audit because the available browser was signed out. Do not mark steps passed until observed.

## Process / consultation index

| Required artifact | Link / verified state |
|---|---|
| Sprint plan (S2-11) | [Existing Google document](https://docs.google.com/document/d/1mTKSBYr0hHRpPx4Z7bw_LnE2cheXliboVSehyMURfnI/edit); link exists, content/access not verified |
| Sprint 2 issue tracker | [Sprint 2 issues](https://github.com/Anthonyiwnl/tsek/issues?q=is%3Aissue%20label%3Asprint-2); a tracker view, not proof of a separate project board |
| Actual standups (2–3) | Missing links/notes. Supply dates, attendees, actual discussion and blockers from real records. Do not backdate or invent meetings. |
| Sprint 2 retrospective | Missing actual meeting record/link. Include what went well, what did not, and agreed action owners. |
| Project board | Team must confirm the board URL used during the sprint, if separate from the issue tracker. |
| Pipeline metrics | [PIPELINE_METRICS.MD](PIPELINE_METRICS.MD): historical Sprint 2 row exists; current Sprint 4 row is blank. Do not present the 1 Nov snapshot as current. |
| Consultation demo | Public UI and test sequence above are available; completed authenticated walkthrough/recording link pending. |
| Sprint 1 carryover | [SPRINT_1.md](sprints/SPRINT_1.md) records actual slippage rather than backdating completion. Its historical open statuses are stale: #8, #10, #11 and #14 are now closed as of this audit. Preserve historical dates; add current disposition separately. |

## Closure gate

Keep #25 open until the authenticated live test, hosted persistence/owner isolation evidence, actual standups/retrospective, and consultation artifact links are attached and reviewed.
The evidence PR must not be merged solely to close the issue while these items are pending.
