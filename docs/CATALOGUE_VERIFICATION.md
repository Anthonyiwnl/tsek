# Issue #10: deployed catalogue verification

Verified 27 October 2026 (Asia/Manila).

Preview: https://tsek-e8r2165o5-heroopogis-projects.vercel.app
Backend: https://tsek-fl10.onrender.com

The preview was built from the integration branch plus the Vercel catalogue
rewrite now checked into this branch. It is a preview deployment; production
has not been promoted and this PR has not been merged.

## Verified

- Preview build and TypeScript check passed.
- GET /api/document-types through the preview returned HTTP 200 and three types:
  Barangay Clearance, Certificate of Indigency, Certificate of Residency.
- Each type's /requirements route returned HTTP 200 and three database records:
  Valid government-issued ID, Proof of residency, Community Tax Certificate (Cedula).
- In a real browser: Get started, Continue to demo, New application showed loading,
  then the three types with their backend descriptions and three requirements each.
- Selecting Barangay Clearance and continuing showed ID and residency as required,
  and Cedula as optional/conditional, matching is_required from the backend.
- Returning and switching to Certificate of Residency updated the service heading
  and displayed its requirement list. The current database has the same three
  requirement names for these services.
- No API credentials or database credentials were put in the frontend.

## Routing

Only the catalogue list and requirement routes are forwarded by Vercel to Render.
The browser calls its own origin. Keep VITE_CATALOGUE_ENDPOINT unset or set to
/api/document-types. Local Vite still proxies to the local backend on port 3000.

## Remaining acceptance

- Teammate review and approval before merging; production release follows the team workflow.
- Issue #10 also asks for a database-backed change demonstration. This verification
  reads the existing hosted catalogue; no database records were changed or seeded.
- Dashboard/account/application records remain demos. This evidence covers the
  New Application catalogue and requirement screen, not authentication or uploads.

## Hero frontend follow-up - 27 October 2026

Updated preview: https://tsek-quj6gt1dl-heroopogis-projects.vercel.app
PR: https://github.com/Anthonyiwnl/tsek/pull/49

- Merged origin/main (5fd5c41) into the integration branch.
- Removed the unused sample /api/services handler and its four fixture tests.
  Six catalogue-loader tests remain and pass. CI now runs frontend tests.
- Fixed reselecting the current service clearing the user's local selections.
- Clarified required-file completion and demo-only administrator feedback.
- Added accessible names and a shared native dialog with initial focus, keyboard
  focus wrapping, Escape dismissal, and restoration of focus to the trigger.
- Frontend lint, TypeScript, and production build passed. Local build retains
  the pre-existing missing VITE_VERCEL_GIT_COMMIT_SHA warning.
- Browser checks on the updated implementation confirmed loading and real
  catalogue data, required/conditional labels, same-service purpose retention,
  and purpose reset plus updated heading when switching services.
- Final preview keyboard check confirmed initial focus on Stay logged in,
  Shift+Tab wraps to Log out, Escape closes the dialog, and focus returns to
  the original Log out trigger.

### Ownership and outstanding acceptance

Hero's frontend implementation and review fixes are ready for teammate review.
Issue #10 is assigned to Francis. The database-change demonstration is shared
integration acceptance: Ken or Francis makes a controlled temporary change in
an agreed test database; Hero verifies the changed value in this deployed UI
(after leaving and reopening New Application), then verifies restoration.
No database write was performed in this follow-up; no backend database connection
is configured locally. This acceptance criterion remains open.

Teammate approval, merge, and production release remain pending. The preview
is not a production release. Loading was observed in the browser; empty/error
payloads are covered by loader tests and UI code inspection, not an induced
hosted database outage. The demo account and administrative screens remain
prototypes; this work does not implement authentication, uploads, or AI analysis.
