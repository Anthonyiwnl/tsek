# Approved citizen UI and TSEK identity

## Current design: Queue Ticket (chosen 17 November 2026)

Design source: [TSEK — Redesign Proposals](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk).
Build only from the pages named **Final · 01–10**; the proposal pages P1–P5
are kept for reference.

| Page | What it covers |
|---|---|
| [Final · 01 Components](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-371) | Colours and text tokens, Button, Badge, form fields, App header, Ticket card, Tracker, Requirement row |
| [Final · 02 Public](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-372) | Landing, sign in, sign-in error (on hold, see PR #230) |
| [Final · 03 Citizen overview](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-373) | My applications with the Dashboard merged in, New application modal |
| [Final · 04 Ticket draft](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-374) | Application page: ticket header, tracker, checklist, documents, submit, delete modal |
| [Final · 05 Ticket submitted](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-375) | Awaiting review, approved, not approved |
| [Final · 06 Staff](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-376) | Staff queue and review screen |
| [Final · 07 States](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-377) | Loading, empty and error states |
| [Final · 08 Mobile](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=9-378) / [09 Tablet](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=22-1747) | 390 px and 1024 px layouts |
| [Final · 10 Prototype](https://www.figma.com/design/iWfptXHVyfFxuQaMvJTzlk?node-id=22-3072) | Clickable demo path |

The work is tracked in the [UI refresh milestone](https://github.com/Anthonyiwnl/tsek/milestone/5)
and logged in [SCOPE_CHANGES.md](SCOPE_CHANGES.md). Until those issues merge,
the live app still follows the earlier design below.

## Earlier design (live until the refresh merges)

Design source: [TSEK combined concept](https://www.figma.com/design/TP7VAonK573U6vjm5bxJEt).

- Citizen dashboard: `2:34`.
- Guided document check: `3:10`.
- Refined logo: `25:46` (primary), `25:23` (reversed).

The approved colors, spacing and cards live in the app's stylesheets
(`index.css` and the workspace styles). The earlier `FigmaDesign.css`
adaptation was never imported and was removed in #234. `CitizenDashboard.tsx`
contains the overview, with illustrative records in `demoApplications.ts`.
Shared branding in `DesignUI.tsx` updates public, citizen, and administrator
surfaces. Original exported SVGs live in `frontend/public/figma`; no temporary
Figma URLs are used at runtime. Source Sans 3 is the UI typeface and Sora is
used for the wordmark.

The existing five checklist views are grouped into three visual stages:
choose service (selection and requirements), upload documents (local file
selection), and review checklist (review and results). Requirements come from
`/api/services`, which loads the database catalogue through the backend when
`TSEK_BACKEND_URL` is set. Backend failures return 503 without falling back to
samples; local samples remain available when no backend is configured. Loading,
retryable error, and empty states remain intact. Optional requirements are
labeled "If applicable". Upload controls
support local file selection, replacement, removal, and drag-and-drop with
the existing PDF/JPEG/PNG, non-empty, 5 MB validation.

The Figma sample's claimed AI extraction, identity checks, and submission are
not simulated in the functional checklist. Actual file selections drive its
counts and results. Nothing is uploaded, persisted, or submitted. The sample
dashboard retains clearly labeled example guidance. A separate illustrative
draft is retained in My applications for the existing deletion demonstration.

Validation: frontend lint, TypeScript/Vite production build, catalogue and
services API tests, and browser checks of desktop/mobile layouts, file rejection, valid
selection and progress updates, missing-file review, and navigation.
