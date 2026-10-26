# Backend behavior and evidence matrix

This matrix records behavior implemented on the `backend-hardening`
branch. Analysis reads, storage, quotas, and the provider endpoint are covered.
The analysis request sends uploaded plain-text contents and requirement
descriptions to OpenAI. No deployed evidence is available from this checkout.

| Requirement | Backend behavior | Automated evidence | Deployed evidence |
|---|---|---|---|
| Authenticate private application routes | Bearer token is verified; owner ID comes from the verified subject. | `application CRUD requires authentication and scopes every operation to its owner`; `Neon Auth token verifier checks EdDSA signature, issuer, and user subject` in `backend/test/backend.test.js`. | Not checked. No deployment URL or deployment record was provided. |
| Enforce ownership for reads and mutations | Repository queries scope reads, updates, and deletes by both owner ID and record ID; cross-owner records return 404. | `application CRUD requires authentication and scopes every operation to its owner` in `backend/test/backend.test.js`. | Not checked. |
| Enforce draft-only mutation rules | Updates and deletes match only `draft`; submitted records return 409. | `application CRUD validates inputs, service references, and draft-only changes` in `backend/test/backend.test.js`. | Not checked. |
| Validate malformed and oversized input | Application fields and UUIDs are validated; malformed JSON returns 400 and JSON above 32 KB returns 413. | `application CRUD validates inputs, service references, and draft-only changes`; `application API rejects malformed JSON and invalid bearer tokens` (including the 32 KB limit). | Not checked. |
| Return safe database failures | Unexpected errors are logged without connection details and return a sanitized error with request ID. | `database failure is sanitized and readiness differs from liveness`; `application database failures return sanitized errors with a request ID`. | Not checked. |
| Enforce file ownership and upload limits | PostgreSQL stores files under both application and owner IDs; all reads/deletes match both IDs. Uploads allow four media types, 2 MiB maximum, safe filenames, and draft-only mutations. Downloads are attachments with `no-store` and `nosniff`. | `private file routes enforce owner, draft, media type, and upload size rules` in `backend/test/backend.test.js`. | Not checked. |
| Protect analysis records and limit cost | POST requires an owned draft and an owned plain-text file. Reads are owner/application-scoped; database constraints bind analysis to the same owner, application, and file. A transaction lock limits each owner to three attempts per rolling hour. Provider client caps input at 20 KB, output at 600 tokens, times out after 10 seconds, retries transient failures up to three attempts, and records sanitized failures. | `analysis endpoint verifies file ownership, bounds requests, saves results, and enforces cost limit`; `analysis provider failures are stored and returned without upstream details`; `AI provider retries transient failures and returns safe terminal errors`. | Not checked. |

The catalogue seed contains three demonstration document types and nine sample
requirement rows. These are illustrative data, not a verified statement of the
course's seven requirements or of barangay rules.

## Validation record

**Validated 2026-10-26** on [`backend-hardening`](https://github.com/Anthonyiwnl/tsek/tree/backend-hardening), commit `86a51f1`:

- ESLint passed (`eslint .`).
- Backend test suite passed: 22 tests, 0 failures (`node --test`, Node.js 24.22.1).
- The suite covers ownership and draft-only rules, malformed and oversized requests, upload limits, sanitized database/provider failures, analysis quotas, and retry behavior.

The branch is pushed and [PR #45 is open](https://github.com/Anthonyiwnl/tsek/pull/45), awaiting review. Live deployment configuration is pending in this repository, so there is no deployment URL or post-deployment behavior check to report. No deployed evidence is claimed.
