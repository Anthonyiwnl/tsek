# Consultation 2 technical verification — issue #25

Updated: **8 November 2026 (PHT)**.
PR: [#162](https://github.com/Anthonyiwnl/tsek/pull/162).

**Technical evidence is complete for the revised scope.** Public React CRUD,
PostgreSQL persistence, live two-account isolation, reviewed implementation,
deployment, and the plan/tracker/demo references are verified below.
Final peer approval and required checks still govern merging.

## Scope decision

On 8 November, Francis explicitly requested: “finish the pr #162 please
disregard this Meeting/retrospective evidence.”

Dated standup/Messenger records and retrospective evidence are therefore
**excluded from this PR's completion scope**. They were not supplied or
verified and are not represented as completed. This report documents that
scope change rather than inventing historical meetings or agreements.
The original broader process criterion is not certified as fulfilled.

## Acceptance summary

| In-scope requirement | Verified result |
|---|---|
| Public React create/read/edit/delete | Passed in production, including full-page reloads, delete cancellation and confirmed deletion. |
| Hosted PostgreSQL persistence | Saved purpose/status/owner corroborated by a scoped SELECT; exact test ID absent after cleanup. |
| Invalid input | Blank/whitespace UI input blocked; malformed authenticated API create returned 400. |
| Cross-user safety | Valid account B could not list/read/PATCH/DELETE account A's synthetic draft. Owner data stayed unchanged. |
| Reviewed merge, tests and automatic deployment | Reviewed implementation links and successful staging-to-production deployment below. |
| Consultation references | Sprint 2 plan, milestone tracker, live application and historical pipeline metrics linked below. |

## Reviewed implementation

GitHub review records showed approval by `Anthonyiwnl` for these merged PRs:

| Work | Branch | PR |
|---|---|---|
| Sign-in and create (#18) | `codex/hero-complete-application-management` | [#59](https://github.com/Anthonyiwnl/tsek/pull/59) |
| List and details (#19) | `codex/hero-application-workflows` | [#54](https://github.com/Anthonyiwnl/tsek/pull/54) |
| Draft edit/delete (#20) | `codex/hero-edit-delete-applications` | [#55](https://github.com/Anthonyiwnl/tsek/pull/55) |
| Backend draft mutations (#17) | `backend-17-update-delete` | [#147](https://github.com/Anthonyiwnl/tsek/pull/147) |
| CRUD failure/ownership tests (#22) | `issue-22-crud-tests` | [#113](https://github.com/Anthonyiwnl/tsek/pull/113) |

Create/read backend: [#114](https://github.com/Anthonyiwnl/tsek/pull/114).
The sign-in correction [#164](https://github.com/Anthonyiwnl/tsek/pull/164)
was approved at head `5a8b33c9e45227226b72128b7627d08407f1d8d2`
and merged as `64ab81e8da5327611fa1c093b63d6b08172b1721`.

## Validation and deployment

- [Initial reviewed main run](https://github.com/Anthonyiwnl/tsek/actions/runs/42381844985), baseline `e2617f6`: frontend lint/build, 21 Node tests and 25 UI tests; backend lint and 153 tests; staging and production smoke tests passed.
- [Sign-in fix deployment](https://github.com/Anthonyiwnl/tsek/actions/runs/42386169002), merge `64ab81e`: checks, staging and production passed. This deployment preceded the successful public-UI acceptance below.
- Independent local validation at that later baseline passed **199 backend + 46 frontend tests**, plus lint/typecheck/build.
- Finalization validation after updating the evidence branch to main through `dc0feda`: `npm run check` completed with exit 0, **201 backend + 46 frontend tests passed** (247 total), plus lint/typecheck/build. `git diff --check` passed.
- At PR heads `7ad56b3` and `6c95569`, the GitHub install/lint/build/test, issue-link, secret scan, dependency audit and AI-review checks were independently verified successful. The earlier inline documentation finding was resolved by its reviewer.
- **Local reproducibility limit:** later Windows reruns repeatedly failed the cached-session UI test's empty-list heading wait; one broader run also had other timing/text-entry failures. The last such rerun passed 24/25 UI tests and stopped before backend checks. These failures are recorded separately from the passing CI and live checks; assertions/timeouts were not weakened. Check the final PR head's own CI result before merging.

Backend application tests use embedded PostgreSQL/PGlite and cover owner
scoping, invalid bodies/IDs, draft-only mutations, safe database errors and
rollback. UI tests mock network responses. Those tests are not substitutes
for the separately recorded hosted live acceptance.

Deployment optimization #151 skips a service when its directory has not changed.
Different frontend/backend SHAs can be valid; smoke tests verify each expected
service version. Historical pre-#164 probes reported frontend `e2617f6` and
backend `ad78546`/`7311fa8`; these are historical snapshots, not current
version claims.

## Public production UI acceptance

On 7 November, after #164 deployed, the authenticated public workspace was
tested with a synthetic account and Barangay Clearance draft:

| Step | Observed result |
|---|---|
| Restore session | My applications loaded without the previous sign-in loop. |
| Create | `Issue 25 acceptance test` saved at 23:27:15 PHT. |
| Read after full reload | Same ID and purpose remained visible. |
| Edit | Purpose changed to `Issue 25 acceptance test edited` at 23:27:37 PHT. |
| Read after another full reload | Edited purpose persisted. |
| Delete cancellation | Keep application retained the unchanged draft. |
| PostgreSQL SELECT | Edited purpose, draft status and expected test owner confirmed. |
| Authorized deletion | UI reported success; full reload showed an empty list. |
| PostgreSQL cleanup check | COUNT on the exact test ID returned 0. |
| Invalid form | Blank required input/whitespace-only purpose kept Save disabled. |

UI test record: `bd25b5d3-9fd1-4d3e-aee6-f865d0d3be97`.
Database corroboration used project `blue-salad-78728440`, production branch
`br-autumn-violet-b5rtku8i`, database `neondb`, and only the synthetic ID.

The production Auth trusted origin was also corrected after a diagnostic
request reproduced 403 `INVALID_ORIGIN`; adding the exact frontend origin
changed the synthetic probe to normal credential validation. #164 corrected
the SDK session-JWT handling. No authentication protections were disabled.

## Live two-account API isolation

Reported at **8 November 2026 00:56:50 PHT**
(`2026-11-07T16:56:50.381Z`). Two distinct ordinary test users authenticated
against the real production Neon Auth server. A temporary local test client
made real bearer-authenticated requests to the production API with no mocked
Auth, API or database responses.

| Check | Result |
|---|---|
| Account A creates draft / reads before probes | 201 / 200 |
| Account B authenticated list | Valid 200 response; account A's record absent |
| Account B cross-owner GET | 404 |
| Account B cross-owner PATCH | 404 |
| Account B cross-owner DELETE | 404 |
| Account B create with invalid empty body | 400 |
| Account A reads after all probes | 200; original purpose unchanged |
| Combined test result | `passed: true` |
| Explicitly authorized account-A cleanup | DELETE 204; subsequent read 404; `cleaned: true` |
| Independent hosted PostgreSQL check | COUNT on exact synthetic ID returned 0 |

Isolation record: `159e26b4-9cd5-4318-acc0-c356e8376199`.
Passwords/tokens stayed in memory and were excluded from logs and source.
After cleanup, the temporary helper was stopped and removed.
This is a live API isolation test; the public-UI workflow is recorded separately.

Initial independent read-only checks also confirmed 200 health/catalogue
responses on staging and production (three catalogue records each), 401
`MISSING_BEARER_TOKEN` on both protected endpoints without a token, and 401
`INVALID_BEARER_TOKEN` for an invalid production token. Authenticated staging
CRUD was not exercised and is not claimed.

## Consultation references

| Artifact | Link and limits |
|---|---|
| Sprint 2 plan | [AI PROGRESS — Sprint 2 tab](https://docs.google.com/document/d/1mTKSBYr0hHRpPx4Z7bw_LnE2cheXliboVSehyMURfnI/edit?tab=t.5ot6xn31xhou#heading=h.k39c1kvv4f6q). Verified: 19–25 October goal, five members' responsibilities, workflow and consultation checklist. |
| Current sprint tracker | [Sprint 2 milestone](https://github.com/Anthonyiwnl/tsek/milestone/2). Verified 8 November: 10 closed issues, one open (#25). This is a milestone tracker, not a dedicated kanban board or evidence of historical meeting use. |
| Task list | [Sprint 2 issues](https://github.com/Anthonyiwnl/tsek/issues?q=is%3Aissue%20label%3Asprint-2). |
| Live demo | [Application workspace](https://tsek-seven.vercel.app/#/applications) / [homepage](https://tsek-seven.vercel.app/). Homepage returned 200 and frontend commit `64ab81e` on 8 November. No video recording is claimed. |
| Delivery proof | [Successful staging/production deployment](https://github.com/Anthonyiwnl/tsek/actions/runs/42386169002). |
| Pipeline metrics | [PIPELINE_METRICS.MD](PIPELINE_METRICS.MD). Historical Sprint 2 row exists; its 1 November snapshot is not presented as current Sprint 4 metrics. |
| Sprint 1 carryover | [SPRINT_1.md](sprints/SPRINT_1.md) preserves actual slippage. Its historical open statuses for #8/#10/#11/#14 are stale; those issues were closed by this audit. |
| Meeting/retrospective records | Excluded at Francis's explicit request on 8 November; not supplied or verified. |

## Review and merge

The technical packet is ready for teammate review under the revised scope.
Merge only when final-head required checks pass, the branch is up to date,
review conversations are resolved, and a teammate approves as required by
the repository. Agents do not approve their own work or bypass protection.
