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
