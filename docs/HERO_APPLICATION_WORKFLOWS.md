# Authenticated application workflows

PR #59 supplies existing-account Neon sign-in and application creation on current main.
The public login/get-started links open #/applications. Catalogue and application
creation use the backend API; failed saves preserve entered fields.
Configure VITE_NEON_AUTH_URL to the same Neon Auth instance as the backend.
VITE_API_BASE_URL defaults to /api through the development proxy. On Vercel,
set it to that environment's backend URL ending in /api; see STAGING.md.

PR #54 adds list/details and PR #55 adds draft edit/delete as a review stack.
Upload/analysis work remains in PR #56 and is excluded from this stack.

Automated tests use synthetic accounts and mocked network responses; they do
not prove a live user's authenticated acceptance. See PRs for validation results.


## Upload and analysis UI (#29)

PR #56 builds on #55 and retains the current dashboard, authentication,
pagination, environment configuration, and draft mutation fixes.
Documents are uploaded separately from analysis; failed analysis never retries
itself. Loading/unavailable analysis reads are distinct from an unanalyzed file,
persisted error codes show corrective instructions after reopening a record,
and empty requirement lists never claim completion.

Uploads support TXT/PDF/JPEG/PNG up to 2 MiB. The analysis UI currently enables
plain-text files up to 20,000 bytes. Analysis and checklist API integration still
requires #28; current main provides file uploads but does not expose
`/api/applications/:id/analyses` or `/api/applications/:id/checklist`.
Keep this PR draft until the backend contract is integrated and authenticated
live desktop/mobile acceptance is recorded. Frontend tests use synthetic
responses and backend tests stub providers; these are not live acceptance.

The old optional browser/PGlite harness depended on the superseded PR #45
`private-data.js` implementation. It is removed from this stack; the normal
frontend/backend checks cover the maintained code instead.
