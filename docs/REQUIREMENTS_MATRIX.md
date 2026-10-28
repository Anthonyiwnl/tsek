# Backend behavior and evidence matrix

## Document catalogue (issues #7 and #8)

| Requirement | Backend behavior | Automated evidence | Deployed evidence |
|---|---|---|---|
| Build the catalogue schema and demonstration seed (#7) | Migration `001_catalogue.sql` creates document types and requirements with UUID keys, foreign keys, uniqueness/check constraints, and a lookup index. The repeatable seed inserts Clearance, Residency, and Indigency with requirements explicitly described as demonstration data. | `migrations and seed are repeatable without replacing IDs or duplicating records`; `foreign keys, uniqueness and sort order constraints reject bad records`; `failed database transactions roll back all changes` in `backend/test/backend.test.js`. | Verified 2026-10-27 on the Neon TSEK project's `development` branch in AWS Asia Pacific (Singapore): all four migrations and the seed completed; the database contains 3 document types and 9 requirements. |
| Expose the PostgreSQL catalogue (#8) | `GET /api/document-types` returns active catalogue rows; `GET /api/document-types/:id/requirements` returns ordered requirements. `/health/ready` reports database readiness, and `backend/README.md` documents reproducible PowerShell and Postman requests. | `catalogue HTTP endpoints return seeded, ordered database records`; `invalid UUIDs, missing records, and unknown routes return JSON errors`; `inactive types are hidden and a type without requirements returns an empty array`; `database failure is sanitized and readiness differs from liveness`. | Verified 2026-10-27 using the backend against the Neon development database: `/health/ready` returned 200; `/api/document-types` returned 3 rows; a selected requirements route returned 3 rows; malformed and missing IDs returned 400 and 404. PR #4 is closed. A public backend deployment and deployment URL remain pending. |

This matrix records behavior implemented on the `backend-hardening`
branch. Analysis reads, storage, quotas, and the provider endpoint are covered.
The analysis request sends uploaded plain-text contents and requirement
descriptions to OpenAI. No deployed evidence is available from this checkout.

| Requirement | Backend behavior | Automated evidence | Deployed evidence |
|---|---|---|---|
| Authenticated create/read and verified ownership (#15, #16) | `POST /api/applications` creates a draft; list and detail reads are scoped to the verified bearer-token subject. Request validation rejects missing/invalid document type IDs, unauthenticated calls return 401, and unknown or other-owner records return 404. Issue #16's existing implementation is on [`backend/applications-crud`](https://github.com/Anthonyiwnl/tsek/tree/backend/applications-crud), with its implementation PR at [PR #5](https://github.com/Anthonyiwnl/tsek/pull/5); this work links that implementation rather than recreating it. | `application CRUD requires authentication and scopes every operation to its owner`; `application CRUD validates inputs, service references, and draft-only changes`; `Neon Auth token verifier checks EdDSA signature, issuer, and user subject`. The backend-hardening regression suite and ESLint passed on 2026-10-28 (Node.js 24.22.1; 23 tests). PR #5 remains open and is not mergeable, so review/merge is incomplete. | Live signed-in CRUD is not checked: the new Neon TSEK project has no `neon_auth` schema configured, and the team project and public backend deployment are not available for verification yet. |
| Edit/delete and draft-only mutation rules (#17) | Repository updates and deletes are owner-scoped and match only `draft`; submitted records return 409. | `application CRUD requires authentication and scopes every operation to its owner`; `application CRUD validates inputs, service references, and draft-only changes` in `backend/test/backend.test.js`. | Not checked. |
| Validate malformed and oversized input (#16, #17, #22) | Application fields and UUIDs are validated; malformed JSON returns 400 and JSON above 32 KB returns 413. | `application CRUD validates inputs, service references, and draft-only changes`; `application API rejects malformed JSON and invalid bearer tokens` (including the 32 KB limit). | Not checked. |
| Return safe database failures | Unexpected errors are logged without connection details and return a sanitized error with request ID. | `database failure is sanitized and readiness differs from liveness`; `application database failures return sanitized errors with a request ID`. | Not checked. |
| Enforce file ownership and upload limits (#26) | PostgreSQL stores files under both application and owner IDs; all reads/deletes match both IDs. Uploads allow four media types, 2 MiB maximum, safe filenames, and draft-only mutations. Downloads are attachments with `no-store` and `nosniff`. | `private file routes enforce owner, draft, media type, and upload size rules` in `backend/test/backend.test.js`. | Not checked. |
| Protect analysis records and limit cost (#34) | POST requires an owned draft and an owned plain-text file. Reads are owner/application-scoped; database constraints bind analysis to the same owner, application, and file. A transaction lock limits each owner to three attempts per rolling hour. Provider client caps input at 20 KB, output at 600 tokens, times out after 10 seconds, retries transient failures up to three attempts, and records sanitized failures. | `analysis endpoint verifies file ownership, bounds requests, saves results, and enforces cost limit`; `analysis provider failures are stored and returned without upstream details`; `AI provider retries transient failures and returns safe terminal errors`. | Not checked. |
| Validate normalized analysis and compute persisted checklist decisions (#28) | Server validates extracted fields and one decision per persisted requirement, computes the detected document/service match, stores normalized JSON with the source file, and exposes an owner-scoped checklist aggregated from each saved file's latest valid analysis. Required items need matching-service evidence marked complete. | `analysis endpoint verifies file ownership, bounds requests, saves results, and enforces cost limit` verifies normalized storage and checklist calculation; `invalid structured AI output is rejected, recorded as failed, and excluded from checklist completion` verifies malformed-output handling and safe incomplete results. | Not checked. |

The catalogue seed contains three demonstration document types and nine sample
requirement rows. These are illustrative data, not a verified statement of the
course's seven requirements or of barangay rules.

## Validation record

**Validated 2026-10-28** on [`backend-hardening`](https://github.com/Anthonyiwnl/tsek/tree/backend-hardening), commit `79807d4`:

- ESLint passed (`eslint .`).
- Backend test suite passed: 23 tests, 0 failures (`node --test`, Node.js 24.22.1).
- The suite covers ownership and draft-only rules, malformed and oversized requests, upload limits, sanitized database/provider failures, analysis quotas, and retry behavior.

The branch is pushed and [PR #45 is open](https://github.com/Anthonyiwnl/tsek/pull/45), awaiting review. Live deployment configuration is pending in this repository, so there is no deployment URL or post-deployment behavior check to report. No deployed evidence is claimed.
