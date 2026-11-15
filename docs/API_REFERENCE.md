# TSEK API reference

The Express API defaults to `http://localhost:3000`. JSON resource responses
use `{ "data": ... }` unless described otherwise. All application, file,
analysis, and AI routes require a valid Neon Auth bearer token.

## Authentication and common behavior

Send `Authorization: Bearer <Neon Auth JWT>`. The backend verifies the token's
issuer, signature, expiry, and UUID subject against the configured Neon Auth
JWKS. It derives the owner ID from that subject; clients cannot select an
owner. Another user's application or file is returned as not found.

The API allows the configured frontend origin through CORS. Application JSON
bodies are limited to 32 KB; analysis and AI verification use their own
4 KB/1 MB limits. File uploads are raw request bodies up to 2 MiB. Responses
include `X-Request-Id`; unexpected failures include the same value as
`error.requestId`. Private file and analysis responses use `Cache-Control:
private, no-store`.

## Health and catalogue

| Method and path | Success | Description |
|---|---|---|
| `GET /health` | `200 {"status":"ok","commit":"..."}` | Process liveness and deployed commit. |
| `GET /health/ready` | `200 {"status":"ready"}` | Database readiness; `503` if unavailable. |
| `GET /api/document-types` | `200 {"data":[...]}` | Active types ordered by name and ID. |
| `GET /api/document-types/:id/requirements` | `200 {"data":{...}}` | Active type and its ordered requirements. |

An invalid UUID returns `400 INVALID_ID`; a missing or inactive type returns
`404 NOT_FOUND`.

## Applications

| Method and path | Success | Description |
|---|---|---|
| `GET /api/applications?limit=50&offset=0` | `200 {"data":[...],"hasMore":false}` | List the current user's applications. Limit defaults to 50 and must be 1–100; offset defaults to 0. |
| `POST /api/applications` | `201`, `Location: /api/applications/:id` | Create a draft. |
| `GET /api/applications/:id` | `200 {"data":{...}}` | Get one owned application. |
| `PATCH /api/applications/:id` | `200 {"data":{...}}` | Change `document_type_id` and/or `purpose` on a draft. |
| `DELETE /api/applications/:id` | `204` | Delete an owned draft. |

Example create request:

```http
POST /api/applications
Authorization: Bearer <token>
Content-Type: application/json

{"document_type_id":"8e64840d-e8c8-4b8c-a9ad-ec02cc641a36","purpose":"Proof of address"}
```

Unknown fields, invalid UUIDs, invalid types, and purpose strings over 200
characters return `400 INVALID_BODY`. A missing or inactive document type
returns `422 INVALID_DOCUMENT_TYPE`. Only draft applications can be edited or
deleted; other statuses return `409 APPLICATION_NOT_EDITABLE` or
`APPLICATION_NOT_DELETABLE`. Invalid list pagination returns `400
INVALID_QUERY`.

## Files

| Method and path | Success | Description |
|---|---|---|
| `GET /api/applications/:id/files` | `200 {"data":[...]}` | List file metadata for an owned application. |
| `POST /api/applications/:id/files` | `201`, `Location: /api/applications/:id/files/:fileId` | Upload a raw file body to an owned draft. |
| `PUT /api/applications/:id/files/:fileId` | `201`, `Location: /api/applications/:id/files/:newFileId` | Replace a file on an owned draft. The replacement receives a new file ID. |
| `GET /api/applications/:id/files/:fileId` | Binary response | Download an owned file; response is private and not cacheable. |
| `DELETE /api/applications/:id/files/:fileId` | `204` | Delete a file from an owned draft. |

Upload with a supported `Content-Type` (`text/plain`, `application/pdf`,
`image/jpeg`, or `image/png`) and
`Content-Disposition: attachment; filename="document.txt"`. The filename must
be 1–128 characters. Send the file bytes as the request body, not multipart
form data. The API allows up to 10 files per application, each no larger than
2 MiB. Files can only be added to or removed from drafts. PDF and images can
be stored, but document analysis currently accepts plain-text files only.

Replacement uses the same raw-body headers as upload, with the current file ID
in the path. It atomically removes the old file and its analyses, then creates
a new file ID; if creating the replacement fails, the transaction restores the
original file and analyses. The UI analyzes the new file after a successful
replacement. A missing file returns `404 NOT_FOUND`.

## Document analysis and checklist

| Method and path | Success | Description |
|---|---|---|
| `GET /api/applications/:id/analyses` | `200 {"data":[...]}` | List an application's analysis attempts. |
| `GET /api/applications/:id/checklist` | `200 {"data":{...}}` | Return requirement status derived from saved analyses. |
| `POST /api/applications/:id/analyses` | `201 {"data":{...}}` | Analyze a saved text file. |

Example analysis request:

```http
POST /api/applications/1c1a9b17-fadb-4a15-9d81-03895dff0e2e/analyses
Authorization: Bearer <token>
Content-Type: application/json

{"file_id":"d8baed58-04e5-4eac-8f32-22a6f249c8b5"}
```

The file must be plain text containing 1–10,000 characters. The response
includes a structured result and normalized checklist status. Analysis needs
`AI_VERIFY_ENABLED=true`, `OPENAI_API_KEY`, and the migration-backed quota
tables. If extraction is disabled or unavailable, the endpoint returns
`503 ANALYSES_UNAVAILABLE`. Other failures include `415
TEXT_EXTRACTION_UNAVAILABLE`, `422 INVALID_EXTRACTION_INPUT`, `502
ANALYSIS_PROVIDER_FAILURE` or `INVALID_ANALYSIS`, and `504 ANALYSIS_TIMEOUT`.

## AI verification and schema validation

| Method and path | Success | Description |
|---|---|---|
| `POST /api/verify` | `200 {"result":"...","model":"gpt-4.1-mini"}` | Send text to the optional backend AI verification endpoint. Route is registered only when `AI_VERIFY_ENABLED=true`. |
| `POST /api/analyses/validate` | `200 {"valid":true,"errors":[]}` | Validate an analysis object or JSON string against the response contract. |

Verification request body:

```json
{"input":"Text to verify"}
```

`input` must be a non-empty string of at most 10,000 characters. Invalid input
returns `400 INVALID_INPUT`; an invalid analysis response returns `422` with
`valid: false` and validation errors. Both AI routes require authentication.
The shared quota permits 3 requests per user per UTC minute, 20 per user per
UTC day, and 60 requests total per UTC hour. A denied request returns
`429 AI_RATE_LIMITED` and a `Retry-After` header; an unavailable quota store
returns `503 AI_BUDGET_UNAVAILABLE` without calling the provider.

## Common errors

| Status | Code | Meaning |
|---:|---|---|
| 400 | `INVALID_JSON`, `INVALID_ID`, `INVALID_BODY`, `INVALID_QUERY`, `INVALID_INPUT`, `INVALID_FILENAME`, `INVALID_FILE` | Malformed JSON, invalid IDs or request values, invalid filename, or empty file body. |
| 401 | `MISSING_BEARER_TOKEN`, `INVALID_BEARER_TOKEN` | Authentication is missing or invalid. |
| 404 | `NOT_FOUND` | Route or owner-scoped resource was not found. Disabled `/api/verify` also appears as not found. |
| 409 | `APPLICATION_NOT_EDITABLE`, `APPLICATION_NOT_DELETABLE`, `FILE_LIMIT_REACHED`, `APPLICATION_CHANGED` | State conflict or a draft/file limit. |
| 413 | `REQUEST_TOO_LARGE` | Request exceeds its route's body-size limit. |
| 415 | `UNSUPPORTED_FILE_TYPE`, `TEXT_EXTRACTION_UNAVAILABLE` | Unsupported upload or analysis media type. |
| 422 | `INVALID_DOCUMENT_TYPE`, `INVALID_EXTRACTION_INPUT`, `REQUIREMENTS_UNAVAILABLE` | Valid request shape but unavailable or invalid domain data. |
| 429 | `AI_RATE_LIMITED` | Shared AI quota reached; check `Retry-After`. |
| 502 / 504 | Provider or analysis error code | Provider failure, malformed result, or timeout. |
| 503 | `AUTH_UNAVAILABLE`, `APPLICATIONS_UNAVAILABLE`, `ANALYSES_UNAVAILABLE`, `AI_BUDGET_UNAVAILABLE` | Required service, configuration, or database component is unavailable. |
| 500 | `INTERNAL_ERROR` | Unexpected failure; include `requestId` when reporting it. |

For AI configuration, see the `AI_VERIFY_ENABLED` and `OPENAI_*` entries in
the root README. For migrations and local setup, see the
[backend README](../backend/README.md) and [CI/CD setup](CI_CD.md).

