# Hero application workflows: #19, #20, #29

The landing page sign-in action opens `#/applications`. This route uses Neon
Auth and bearer-authenticated backend requests. It never substitutes prototype
records when an API fails. The older design preview remains separate.

## Setup

In ignored `frontend/.env.local`, set `VITE_NEON_AUTH_URL` to the public Neon
Auth URL ending in `/auth` (not `/authc`). The backend's `NEON_AUTH_BASE_URL`
must identify that same auth service. Use plain URLs, without Markdown brackets.
Never place a database URL or provider secret in a Vite variable.

Existing test accounts can sign in. Account creation and email verification
remain part of the team's sign-in/create integration (#18).

Local requests use `/api`, proxied to port 3000; set `BACKEND_PROXY_TARGET`
to override this. Vercel forwards application routes to the configured Render
backend. The backend must include the endpoints from PR #5 and PR #45, with
its own database, auth and analysis configuration. `VITE_API_BASE_URL` is an
optional public API prefix for other hosting arrangements.

## Behavior

- #19: API-backed list and details, direct detail URLs, search, refresh,
  loading/empty/error states, private data cleared on lost or changed identity.
- #20: create and edit forms, draft-only mutations, confirmation before delete,
  fresh reads after saving, and recovery for forbidden/missing/conflicting writes.
- #29: real raw-body uploads, indeterminate upload/analysis progress, persisted
  results and requirement checklist, mismatch/uncertain/missing-field states,
  explicit retries and no automatic repeated analysis charges.

Uploads support TXT/PDF/JPEG/PNG up to 2 MiB. The current backend analyzes
only UTF-8 plain text up to 20,000 bytes. PDF/image extraction is not available.
No simulated percentage or locally invented AI verdict is displayed.

## Verification on 27 October 2026

From `frontend/`, `npm test` passes 12 Node tests and 11 UI/auth tests.
`npm run lint`, `npm run build` (including TypeScript), and the production
dependency audit pass. Tests cover session failures/account changes, late
responses, edit persistence, delete cancellation/conflicts, upload validation,
failed analysis/retry and backend requirement rendering.

The optional command below exercises the actual `backend-hardening` backend
HTTP handlers against disposable PGlite data, synthetic authenticated users,
and a stub analysis provider. It passed create/list/edit/ownership, upload,
provider failure/retry, checklist, non-draft conflict, deletion and cascade checks:

```powershell
node tests/backend-contract.mjs <path-to-backend-hardening/backend>
```

`--serve` starts that synthetic backend on port 4319 for the development-only
`tests/workspace.html` browser harness. Neither harness nor synthetic identity
is a production entry point. Browser verification confirmed a draft edit
persisted after refresh and the layout fit the observed narrow 612px viewport.

Live Neon sign-in and full deployed workflow acceptance remain unverified:
the preview recovered from a network suspension and displayed the empty
sign-in form with no active test session; a Render probe timed out. The public `/auth` JWKS
endpoint responded successfully; `/authc` returned 404. Local and synthetic
checks do not establish that the deployed backend or a real account works.

Keep the implementation in draft review until the shared backend is deployed,
a test-account login succeeds, and the live create/edit/delete/upload/analysis
flows are exercised. This work builds on the catalogue integration in PR #49.
