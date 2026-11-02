# Approved citizen UI and TSEK identity

Design source: [TSEK combined concept](https://www.figma.com/design/TP7VAonK573U6vjm5bxJEt).

- Citizen dashboard: `2:34`.
- Guided document check: `3:10`.
- Refined logo: `25:46` (primary), `25:23` (reversed).

`frontend/src/FigmaDesign.css` adapts the approved colors, spacing, cards,
sidebar, and three-stage navigation to responsive CSS. `CitizenDashboard.tsx`
contains the overview, with illustrative records in `demoApplications.ts`.
Shared branding in `DesignUI.tsx` updates public, citizen, and administrator
surfaces. Original exported SVGs live in `frontend/public/figma`; no temporary
Figma URLs are used at runtime. Source Sans 3 is the UI typeface and Sora is
used for the wordmark.

The existing five checklist views are grouped into three visual stages:
choose service (selection and requirements), upload documents (local file
selection), and review checklist (review and results). The real sample-service
API and its loading, error, and empty states remain intact. Upload controls
support local file selection, replacement, removal, and drag-and-drop with
the existing PDF/JPEG/PNG, non-empty, 5 MB validation.

The Figma sample's claimed AI extraction, identity checks, and submission are
not simulated in the functional checklist. Actual file selections drive its
counts and results. Nothing is uploaded, persisted, or submitted. The sample
dashboard retains clearly labeled example guidance. A separate illustrative
draft is retained in My applications for the existing deletion demonstration.

Validation: frontend lint, TypeScript/Vite production build, four sample API
tests, and browser checks of desktop/mobile layouts, file rejection, valid
selection and progress updates, missing-file review, and navigation.
