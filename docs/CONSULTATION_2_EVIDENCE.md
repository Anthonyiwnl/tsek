# Consultation 2 / issue #25 verification record

Updated: 8 November 2026 (PHT). Initial audit baseline: `e2617f68be5ac21a7ebdca4ed97732c36e97541a`.
Live CRUD verified after the approved sign-in fix merged as `64ab81e8da5327611fa1c093b63d6b08172b1721`.

**Status: incomplete; keep [issue #25](https://github.com/Anthonyiwnl/tsek/issues/25) open.**
**Complete:** reviewed implementation, deployment, public production create/read/edit/delete,
refresh persistence, invalid form protection, hosted PostgreSQL corroboration,
and live authenticated two-account API isolation.
The synthetic draft was removed and its absence confirmed in PostgreSQL.
Latest recorded checks: **199 backend + 46 frontend tests passed**.

**Outstanding:** the dated team process artifacts below and final peer review.
Messenger was used for coordination/meetings, according to Francis; historical
dates, discussion details and decisions have not yet been supplied as evidence.

## What to do next

| Order | Action | Who / completion evidence |
|---|---|---|
| 1 | Find 2–3 relevant Messenger discussions from Sprint 2 (19–25 October). | Francis/team: dates, participants and relevant excerpts or sanitized screenshots. Use [the meeting template](CONSULTATION_2_MEETING_NOTES.md); do not invent dates or decisions. |
| 2 | Supply a real retrospective record, or hold a retrospective now and date it honestly. | Team: what went well, problems, action owners. A new meeting does not replace missed Sprint 2 meetings. |
| 3 | Use the verified Sprint 2 tracker and live demo links below for consultation. | The milestone is the current sprint tracker, not a dedicated GitHub Projects board. Confirm with the reviewer if a separate board is required. A video recording is optional unless separately required. |
| 4 | Live two-account isolation: completed on 8 November. | Account B could not list/read/edit/delete the owner draft; owner data remained unchanged. Cleanup and zero remaining database rows verified below. |
| 5 | Finish review of PR #162. | Keep draft until evidence is complete; require passing checks and teammate approval before merging. |

Do not clean the old root workspace by deleting or resetting uncommitted work.
This evidence branch uses the separate, clean checkout and changes documentation only.

## Acceptance matrix

| Requirement | Evidence | Result / limit |
|---|---|---|
| Public React create/read/edit/delete persists in PostgreSQL | Merged frontend #59, #54, #55; backend #114, #147; live record below | Verified in the public production UI and corroborated in hosted PostgreSQL, including confirmed deletion. |
| Invalid input and another user's records handled safely | Backend tests plus the live authenticated account-A/account-B API probe below | Verified: valid account-B list excluded the owner record; cross-owner read/PATCH/DELETE returned 404; malformed authenticated create returned 400; account-A data stayed unchanged. |
| Reviewed merge passes API tests and deploys automatically | Peer approvals and main deployment run below | Verified for the audited merge. Deployment smoke tests cover availability/version/catalogue, not authenticated CRUD. |
| Plan, 2–3 actual standups, retrospective, board, metrics and demo links ready | Verified Sprint 2 plan, milestone tracker, live demo and metrics links below | Plan/tracker/live demo links verified. Actual Sprint 2 standup and retrospective evidence is still missing. A separate project board has not been established. |

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

Follow-up after merging current main through `64ab81e` into this evidence branch:
`npm run check` passed with 21 frontend Node tests, 25 UI tests and **199 backend
tests**, zero failures. `git diff --check` passed. The earlier counts above are
historical results for their stated baseline, not current-suite totals.

Documentation cleanup validation: one local run timed out waiting for the auth
UI's empty-list heading. The unchanged full suite passed on rerun (199 backend
+ 46 frontend tests); no test timeout or assertion was weakened. This is a
local timing observation, not evidence of a failing production deployment.

## Initial live read-only checks (historical baseline)

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

## Reusable live acceptance / demo script

Use two authorized test accounts and synthetic records. Never publish passwords, bearer tokens, database URLs or real citizen data.

1. Sign in through the public React UI. Record environment, frontend/backend versions and test time.
2. Create one disposable draft with purpose `Issue 25 acceptance test`; record its returned ID. Refresh the page and reopen it.
3. Edit the purpose to `Issue 25 acceptance test edited`; refresh and verify it persists. Use a narrowly scoped read-only PostgreSQL query for this test ID to corroborate persisted values, if database access is available.
4. Attempt invalid required input; verify no saved record and readable field errors. Exercise a malformed/invalid API request with a valid test-account token and record sanitized status/code without the token.
5. With account B, verify account A's test record is absent from the list and inaccessible by direct ID, including read/update/delete attempts. Confirm account A's record remains unchanged. Use only the synthetic record created for this audit.
6. In account A, open Delete and cancel; verify the record remains. Confirm deletion of that disposable draft; refresh and verify it stays absent, and corroborate its removal in PostgreSQL.
7. Capture sanitized screenshots or a short demo recording and link them here. Repeat necessary acceptance on staging with its own test database; do not infer environment isolation from names alone.

No authenticated live acceptance was performed during the initial audit because the available browser was signed out. The later verification below supersedes that initial limitation only for the steps explicitly recorded.

### Live follow-up after sign-in repair

On 7 November 2026, [PR #164](https://github.com/Anthonyiwnl/tsek/pull/164)
was approved by `Anthonyiwnl` at head `5a8b33c9e45227226b72128b7627d08407f1d8d2`,
merged as `64ab81e8da5327611fa1c093b63d6b08172b1721`, and deployed successfully by
[run 42386169002](https://github.com/Anthonyiwnl/tsek/actions/runs/42386169002).
Production Auth's exact frontend origin was added after a synthetic probe reproduced
403 `INVALID_ORIGIN`; the same probe then reached normal credential validation (401).
The PR corrected the SDK session-JWT handling that caused immediate sign-out.

Observed through the public production React UI, signed in as the synthetic test user:

| Step | Observed result |
|---|---|
| Restore session | `My applications` loaded; the sign-in loop no longer occurred. |
| Create | Barangay Clearance with purpose `Issue 25 acceptance test` saved as a draft at 23:27:15 PHT. |
| Read after full page reload | Same record and original purpose remained visible. |
| Edit | Purpose changed to `Issue 25 acceptance test edited` at 23:27:37 PHT. |
| Read after another full reload | Edited purpose remained visible. |
| Delete cancellation | Confirmation dialog warned of permanent deletion; `Keep application` returned to the unchanged draft. |
| PostgreSQL corroboration | Narrowly scoped SELECT on the created ID returned the edited purpose, `draft` status, and `expected_test_owner = true`. |
| Confirmed deletion | After explicit user confirmation, `Confirm deletion` returned success and an empty list; a full reload remained empty. |
| Invalid form | Blank required input and a whitespace-only purpose left Save disabled. Cancel returned to the empty list without creating a record. |

Synthetic record ID: `bd25b5d3-9fd1-4d3e-aee6-f865d0d3be97`.
The SQL check used project `blue-salad-78728440`, production branch `br-autumn-violet-b5rtku8i`, database `neondb`.
Only this synthetic record was queried; no bearer token, password or database credential is included.

The user explicitly authorized permanent deletion of this test ID. A follow-up
PostgreSQL COUNT on that exact ID returned zero, corroborating its removal.
The account-B and malformed authenticated API checks were completed in the later follow-up below. Authenticated staging CRUD has not been exercised.

### 8 November preparation and validation limits

Two distinct ordinary test accounts were authenticated through the real
production Neon Auth server using privately entered passwords. The temporary
local client sent real bearer-authenticated requests to the production backend;
it did not stub authentication, API responses or database operations. Passwords
and tokens were held in memory only and were not included in its result logs.

The sanitized server report at **8 November 2026 00:56:50 PHT**
(`2026-11-07T16:56:50.381Z`) recorded:

| Check | Observed result |
|---|---|
| Account A creates synthetic draft | 201 |
| Account A reads it before probes | 200 |
| Account B authenticated list | Valid 200 response; owner record absent |
| Account B reads account A record | 404 |
| Account B attempts PATCH | 404 |
| Account B attempts DELETE | 404 |
| Account B creates with invalid empty body | 400 |
| Account A reads after all probes | 200; original purpose unchanged |
| Combined isolation result | `passed: true` |
| User-authorized account-A cleanup | 204; subsequent owner read 404; `cleaned: true` |
| Independent PostgreSQL cleanup check | COUNT for the exact synthetic ID returned 0 |

Isolation test record: `159e26b4-9cd5-4318-acc0-c356e8376199`.
Cleanup was explicitly authorized for that record by Francis. The temporary
helper was stopped and removed after cleanup; no application records or
credentials were added to source control. This is a live API isolation test;
the separate public-UI CRUD walkthrough is documented above.

The tracker/demo-link documentation update ran `npm run check`, but the local UI
suite failed four cases (including wait/test timeouts and a text-entry assertion).
An unchanged one-worker UI rerun passed 24 of 25 tests; the cached-session test
again timed out waiting for the empty-list heading. The root command stopped
before backend validation. Assertions/timeouts were not changed. These results
do not invalidate the earlier recorded pass, but they are not a new passing
validation: inspect PR checks and investigate reproducibility before merge.

The isolation-evidence update reran the required root check: frontend lint/build
and 21 Node tests passed; UI tests passed 24/25, with the same empty-list heading
wait failure. Backend checks were not reached. At head `7ad56b3`, all GitHub PR
checks, including the full install/lint/build/test check, were independently
verified green. Record both observations; the live API isolation pass does not
erase the local timing failure, and no assertions were loosened to force a pass.

## Process / consultation index

| Required artifact | Link / verified state |
|---|---|
| Sprint plan (S2-11) | [Sprint 2 tab in AI PROGRESS](https://docs.google.com/document/d/1mTKSBYr0hHRpPx4Z7bw_LnE2cheXliboVSehyMURfnI/edit?tab=t.5ot6xn31xhou#heading=h.k39c1kvv4f6q), opened and exported read-only on 7 November 2026. Verified title: `Sprint 2: Core Resource and API (October 19–25)`. Includes sprint goal, five members' responsibilities, CRUD/API/database/UI/testing/deployment workflow, and consultation checklist. The earlier first-tab-only export was incomplete and does not establish that this document lacks a Sprint 2 plan. The selected Sprint 2 tab contains no dated standup entries, retrospective record, board URL or recorded demo link. |
| Sprint 2 issue tracker | [Sprint 2 issues](https://github.com/Anthonyiwnl/tsek/issues?q=is%3Aissue%20label%3Asprint-2); a tracker view, not proof of a separate project board |
| Actual standups (2–3) | Missing links/notes. Supply dates, attendees, actual discussion and blockers from real records. Do not backdate or invent meetings. |
| Sprint 2 retrospective | Missing actual meeting record/link. Include what went well, what did not, and agreed action owners. |
| Current sprint tracker / board reference | [Sprint 2 milestone](https://github.com/Anthonyiwnl/tsek/milestone/2), verified through GitHub on 8 November: title `Sprint 2`, 10 closed issues and 1 open issue (#25). [Open/closed Sprint 2 issues](https://github.com/Anthonyiwnl/tsek/issues?q=is%3Aissue%20label%3Asprint-2) provide the linked task list. This is a milestone/issue tracker, not a dedicated kanban project or proof that it was used during historical meetings. The public [Projects page](https://github.com/Anthonyiwnl/tsek/projects) showed no linked project on 7 November; a separate private/unlinked board remains unconfirmed. |
| Pipeline metrics | [PIPELINE_METRICS.MD](PIPELINE_METRICS.MD): historical Sprint 2 row exists; current Sprint 4 row is blank. Do not present the 1 Nov snapshot as current. |
| Consultation live demo | [Public application workspace](https://tsek-seven.vercel.app/#/applications) and [homepage](https://tsek-seven.vercel.app/). The homepage returned HTTP 200 and frontend commit `64ab81e8da5327611fa1c093b63d6b08172b1721` on 8 November. Owner CRUD was exercised through this workspace as recorded above; use the reusable demo script to present it. [Successful deployment run](https://github.com/Anthonyiwnl/tsek/actions/runs/42386169002). No video recording is claimed. |
| Sprint 1 carryover | [SPRINT_1.md](sprints/SPRINT_1.md) records actual slippage rather than backdating completion. Its historical open statuses are stale: #8, #10, #11 and #14 are now closed as of this audit. Preserve historical dates; add current disposition separately. |

## Closure gate

Owner CRUD and hosted persistence are complete. Keep #25 open until the remaining
actual standup/retrospective evidence and consultation
artifact links are attached and reviewed, or the unmet process criteria receive
an explicit documented decision from the course/project authority.
The evidence PR must not be merged solely to close the issue while these items are pending.
