# Hero application workflows

## Review scope

PR #54 implements only #19: authenticated application lists and details,
search, direct detail URLs, refresh, loading/empty/error states and session
recovery. It is based on catalogue PR #49 to keep that work out of its diff.
The Neon sign-in adapter is necessary to load private records; account creation
remains part of #18.

The dependent #20 change adds draft editing and confirmed deletion, fresh reads
after saving, and failure/conflict recovery. It is based on the #19 branch.

The dependent #29 change adds raw uploads, progress, backend analysis results,
requirement checklists and retry/recovery states. It is based on the #20 branch.
Uploads support TXT/PDF/JPEG/PNG up to 2 MiB; analysis supports UTF-8 plain text
up to 20,000 bytes. PDF/image extraction remains unavailable in the backend.

## Configuration and acceptance

Set the public `VITE_NEON_AUTH_URL` in ignored `frontend/.env.local` or the
frontend build environment. Its URL ends in `/auth`, not `/authc`. The backend's
`NEON_AUTH_BASE_URL` must identify the same auth service. Do not put database
credentials or provider secrets in Vite variables.

Local `/api` requests proxy to port 3000; `BACKEND_PROXY_TARGET` overrides it.
Vercel proxies to the configured Render backend. `VITE_API_BASE_URL` is an
optional public API prefix. Backend endpoints, database migrations and auth
must be deployed before live acceptance (PR #5; analysis also needs PR #45).

Run `npm test`, `npm run lint` and `npm run build` in `frontend/` for each PR.
Automated tests use synthetic records and mocked auth; they do not prove live
Neon sign-in. The combined implementation passed a disposable PGlite backend
contract test and browser draft-persistence check before the split.

Live acceptance remains pending: the preview displayed an empty sign-in form
without an active test account, and a Render probe timed out. Keep all three
PRs draft until their respective live checks and teammate review are complete.
Merge in dependency order and retarget each next PR to main after its parent
is merged. Each PR must have exactly one closing issue reference.

Optional integration: `node tests/backend-contract.mjs <backend-hardening/backend>`
uses disposable PGlite, synthetic auth and a stub analysis provider. `--serve`
starts port 4319 for the development-only `tests/workspace.html` harness.
