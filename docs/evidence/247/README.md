# #247 — tablet and mobile layouts

Implemented from `origin/main` at `e2d2404`, after #283, #288 and #315 merged.

## Changes

- Compact mobile navigation on public and signed-in screens, with keyboard dismissal and sign-out access.
- Below 768px: vertical ticket progress, stacked requirements and ticket sections, staff queue cards, wrapped status tabs, and full-width dialog actions.
- At 768–1199px: citizen side panels follow documents; staff review retains a 360px decision panel. Desktop ticket columns begin at 1200px.
- Sign-in grid sizing, tablet staff tables, and touch targets corrected without changing backend, auth or application workflows.

The implementation follows the layouts and breakpoint rules inspected in
Figma Final 08 Mobile and Final 09 Tablet. The Figma connector denied design-context
access; desktop references were inspected instead. Final visual approval remains
with the reviewer, and pixel-exact matching is not claimed.

## Validation

- `npm run check`: frontend lint/build, 24 Node tests, 127 Vitest tests; backend lint and 246 tests.
- `node scripts/check-responsive.cjs`: 68 scenarios pass at 390, 768, 1024 and 1440px.
- No page overflow, no horizontal scroll containers, and all rendered interactive targets at least 40px in those scenarios. Checkboxes use their clickable labels.
- Browser checks cover landing, sign-in, password setup, overview, draft, populated document analysis, submitted/approved/rejected states, create/edit/delete dialogs, empty/error/loading overview states, staff queue and staff review.
- Mobile menu visibility, navigation dismissal, Escape dismissal and focus restoration are exercised. The shared header also has a keyboard regression test.
- Design detector: no findings in the final implementation pass. Existing overview attention-border styling is preserved.

The fixtures use synthetic records, and authentication responses are mocked.
They do not prove real-account integration or live deployment behavior.

## Screenshots

| Screen | 390px | 768px | 1024px |
| --- | --- | --- | --- |
| Landing | [View](landing-390.png) | [View](landing-768.png) | [View](landing-1024.png) |
| Sign-in | [View](sign-in-390.png) | [View](sign-in-768.png) | [View](sign-in-1024.png) |
| Overview | [View](overview-390.png) | [View](overview-768.png) | [View](overview-1024.png) |
| Ticket | [View](ticket-390.png) | [View](ticket-768.png) | [View](ticket-1024.png) |
| Documents | [View](documents-390.png) | [View](documents-768.png) | [View](documents-1024.png) |
| New application | [View](new-application-390.png) | [View](new-application-768.png) | [View](new-application-1024.png) |
| Staff queue | [View](staff-queue-390.png) | [View](staff-queue-768.png) | [View](staff-queue-1024.png) |
| Staff review | [View](staff-390.png) | [View](staff-768.png) | [View](staff-1024.png) |

Measurements are recorded in [measurements.json](measurements.json).
Full-page dialog screenshots include background content below the viewport;
the native dialog backdrop covers the active viewport.

## Reproduce

Use Chrome and an optional Playwright installation outside the repository so
browser tooling does not change the application's dependency lockfiles:

```powershell
npm install --prefix "$env:TEMP/tsek-responsive-tools" playwright
$env:VITE_NEON_AUTH_URL='https://auth.example.test/auth'
npm run dev --prefix frontend -- --host 127.0.0.1 --port 5247 --strictPort
```

In a second terminal at the repository root:

```powershell
$env:PLAYWRIGHT_PACKAGE_JSON="$env:TEMP/tsek-responsive-tools/package.json"
node scripts/check-responsive.cjs
```

The test uses `http://127.0.0.1:5247` by default; override with
`RESPONSIVE_BASE_URL`. Screenshots and measurements are regenerated.
The fixture entry points are excluded from the production build.

## Delivery

PR review and CI are required before merging. Staging and production deploy
from `main`; live deployment validation remains a post-merge step and is not
represented by the local screenshots.
