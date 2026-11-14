# Issue #35 journey verification

Date: 10 November 2026 (Asia/Manila).
Branch: `35-journey-verification`, targeting `main` after rebasing on 15 November 2026.

The journey and keyboard tests below are already present on `main`, including
the newer analysis document-type fixture and replacement tests. The rebase
preserves those tests and adds the remaining responsive CSS fixes and historical
verification evidence. PR #56 is closed; this PR no longer depends on its branch.

## Automated evidence

After the rebase on 15 November 2026, `npm run check` passed: frontend lint,
TypeScript, production build, 85 frontend tests (23 Node + 62 UI), backend lint
and 227 backend tests.

Run `npm run check` from the repository root. The journey tests now on `main` in
`frontend/tests/workspace.test.tsx` use synthetic data and stub API responses:

- Create a draft, retain the selected TXT file after an upload failure, retry,
  analyze explicitly, and reopen the saved application.
- Verify both complete and incomplete requirement outcomes remain visible after
  reopening, without implicitly rerunning analysis.
- Open the draft dialog using Enter, tab from Purpose to Cancel, activate Cancel
  with Enter, and verify focus returns to New application without creating data.

Existing checks cover loading, empty/error recovery, failed saves, late responses,
read-only records, persisted analysis failures and authenticated session recovery.
These tests run in jsdom: they do not establish responsive layout, native dialog
focus trapping, or deployed API behavior.

## Browser verification, 10 November

Tested the actual `ApplicationWorkspace`, native `Modal`, and application CSS
in a Chromium browser at 1440x900, 390x844, and 320x740. PR #171's production
components at the time matched PR #56; the evidence below describes that revision.
A temporary, localhost-only React entry supplied in-memory synthetic API
responses and controlled upload/analysis failures. This verifies rendering and
interaction, not authentication, network transport, database persistence, or AI.

Passed locally:

- Desktop empty list, new draft, service selection, save and details.
- Native dialog Tab wrapping, Escape cancellation, visible focus, and focus
  restoration to New application; mobile edit/save and delete cancellation.
- TXT upload failure retains the selected file; deliberate retry uploads it.
  Upload does not trigger analysis automatically.
- Analysis timeout shows corrective guidance and Retry analysis; deliberate
  retry displays complete fields and checklist on desktop and mobile.
- Incomplete/unreadable results show Needs review, missing requirements and
  actionable guidance. Complete and incomplete results survive navigating
  back to the list and reopening the record in the synthetic session.
- Mobile create, upload, analyze, timeout/retry and complete results at 390px.

Fixed two observed responsive defects: the body's 320px minimum width caused
15px horizontal overflow with a desktop scrollbar at a 320px viewport; extracted
field values were squeezed into fragmented words by the two-column grid.
The minimum width now respects the available width, and fields stack below
600px. After the fix, both document client width and scroll width are 305px
at a 320px viewport with a 15px scrollbar.

Screenshots (synthetic data only):

- [Desktop incomplete result](evidence/hero-2026-11-10/desktop-needs-review.jpg)
- [Mobile complete result](evidence/hero-2026-11-10/mobile-complete.jpg)
- [320px layout after fixes](evidence/hero-2026-11-10/mobile-320-fixed.jpg)

Historical pre-rebase validation on 10 November: `npm run check` passed after
the fixes with 70 frontend tests (24 Node + 46 UI), 202 backend tests, lint,
TypeScript and production build. PR #56's equivalent check passed with 67 frontend
tests and 202 backend tests. That run reported non-failing warnings for the
AuthenticatedWorkspace ref during render and an unset local build SHA. These
counts and warnings describe the old revision; the current post-rebase results
are recorded under Automated evidence above.

## Outstanding deployed acceptance evidence

- Authenticated validation against the deployed backend and a deployment URL for
  the reviewed implementation.
- Deployed loading, empty, success, error and recovery evidence, including
  actual persisted results after reload and a fresh session.

Both PR previews were opened on 10 November and displayed Vercel's
"You Need Access" screen requiring team-owner approval for the signed-in
account. No protection settings were changed and no access request was sent.
Production at https://tsek-seven.vercel.app/ has not been verified for these
changes in this verification session. These are historical access limitations,
not a fresh deployment check. Issue #35 remains open; deployed acceptance is
not established by this record. No live AI requests or real citizen data were used.
