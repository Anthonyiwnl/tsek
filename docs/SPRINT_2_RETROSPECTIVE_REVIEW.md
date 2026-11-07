# Sprint 2 retrospective review from GitHub records

Prepared: **8 November 2026 (PHT)**.
Planned sprint: **19–25 October 2026**.
Related evidence: [issue #25 / PR #162 verification record](CONSULTATION_2_EVIDENCE.md).

**This is a written, record-based retrospective alternative, not meeting minutes.**
No meeting attendance, historical discussion date or team agreement is asserted.
Francis reports Messenger coordination, but dated source messages were not supplied.
The observations below are supported by repository records; the suggested actions
still need team review. Acceptance as a substitute for a course meeting requirement
must be confirmed by the reviewer/instructor.

## What was delivered

| Work | Evidence |
|---|---|
| Sign-in and application creation | Reviewed, merged [#59](https://github.com/Anthonyiwnl/tsek/pull/59) |
| Application list and details | Reviewed, merged [#54](https://github.com/Anthonyiwnl/tsek/pull/54) |
| Draft edit and confirmed deletion | Reviewed, merged [#55](https://github.com/Anthonyiwnl/tsek/pull/55) |
| Owner-scoped backend mutations and failure tests | [#147](https://github.com/Anthonyiwnl/tsek/pull/147), [#113](https://github.com/Anthonyiwnl/tsek/pull/113) |
| Sign-in integration repair | Reviewed, merged [#164](https://github.com/Anthonyiwnl/tsek/pull/164) |
| Live acceptance and cleaned synthetic records | [Technical verification](CONSULTATION_2_EVIDENCE.md), including production UI CRUD and two-account API isolation |
| Automated release verification | [Successful staging/production run](https://github.com/Anthonyiwnl/tsek/actions/runs/42386169002) |

The frontend CRUD PRs #59/#54/#55 merged on **7 November**, and backend mutation
PR #147 merged on **6 November**. These are later than the planned Sprint 2 dates.
This review describes eventual delivery of Sprint 2 scope; it does not claim
those features were delivered during 19–25 October.

## What went well — supported observations

- Small implementation areas have traceable PRs and peer approvals. Create,
  list/details and mutations can be traced separately.
- The release workflow verifies staging before production. Reviewed code and
  passing checks have linked deployment evidence.
- Acceptance reached beyond mock tests: public UI changes survived refresh,
  PostgreSQL corroborated saved/deleted records, and a valid second account
  could not access or mutate the first account's synthetic draft.
- The final local validation recorded 201 backend and 46 frontend passing
  tests, plus lint, type checking and build. Historical test counts are labelled
  by baseline in the technical report.

## Difficulties — supported observations

- **Late integration:** the eventual frontend CRUD merges occurred after the
  planned sprint. The record establishes the dates, not the team's unstated
  reasons for the delay.
- **Deployment configuration:** [run #30](https://github.com/Anthonyiwnl/tsek/actions/runs/41854655436)
  initially stopped at a staging Render hook HTTP 500. A separate wrong-branch
  setting was found and corrected. The HTTP 500's exact cause was not proven
  solely by that branch mismatch; see [INC-08](INCIDENTS.MD).
- **Mocks missed an integration bug:** live sign-in exposed missing trusted-origin
  configuration and the SDK session-token response mismatch fixed by #164.
  Passing mocked UI tests did not establish working deployed authentication.
- **Local test reproducibility:** some Windows reruns timed out waiting for the
  authenticated empty-list view, while CI and later full local validation passed.
  This needs investigation; no production failure is inferred from that alone.
- **Process traceability:** the plan and technical history are available, but
  dated Messenger standup notes and an actual retrospective discussion record
  were not attached to this audit.

## Proposed improvements — not yet team agreements

| Proposal | Suggested responsible role | Verification |
|---|---|---|
| Run a deployed sign-in/create smoke test early, before declaring integration done. | Francis with Hero | Sanitized result linked to the relevant PR. |
| Keep Auth origins, environment mapping and service branches in a release checklist. | Anthony with backend owner | Check each environment and link the release result. |
| Retain live cross-user read/update/delete checks alongside automated owner-scope tests. | Backend owner with Francis | Two real test identities, denied access, unchanged owner record and verified cleanup. |
| Investigate the timing-sensitive local auth UI test without removing assertions. | Hero with Francis | Reproduce under constrained runners and document the confirmed cause/fix. |
| Capture short dated Messenger updates during the next sprint. | All team members | Actual progress, blockers, next step and participant confirmation. |

Owners and target dates must be confirmed by the team; this table does not
assign work to teammates or claim they accepted it.

## Practical alternatives for the missing process record

1. **Asynchronous Messenger retrospective now:** share this review with the team.
   Each person replies with what went well, one problem and one proposed change.
   Preserve the actual date, named replies, corrections and confirmed actions
   as sanitized excerpts or an accessible document. Do not call it an earlier meeting.
2. **A short retrospective now:** discuss this summary, record actual participants
   and agreed actions, and use the real date. This produces a current retrospective,
   not historical Sprint 2 standup evidence.
3. **A GitHub activity timeline:** use PR/commit/review/deployment links to show
   progress and delivery dates. Label it an activity record, not attendance or
   standup minutes, and ask the reviewer whether it satisfies the intended rubric.

The easiest next step is option 1: collect real team replies in Messenger.
One written review or one new retrospective does **not** establish that 2–3
historical standups happened. Historical meeting evidence remains outside this
PR's revised scope unless real records are later supplied.
