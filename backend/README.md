# TSEK backend

TSEK: Smart Document Verification and Requirements Checker. The application helps Filipino citizens prepare documents for barangay services. AI extraction and application validation are planned features.

## Technology stack

- Frontend: React.js (UI and sample checklist in `../frontend/`; PostgreSQL API integration still pending)
- Backend: Node.js 24 LTS, Express 5, REST API
- Database: PostgreSQL hosted on Neon, connected through node-postgres (`pg`)
- AI: OpenAI GPT-4.1 mini (separate Task 4)
- CI/CD: GitHub Actions; Vercel frontend and Render backend (deployment configuration pending)

## Team

| Name | Role |
|---|---|
| Francis Cromwell Tan | Full-stack Developer |
| Axel Josh Lorayna | AI Engineer |
| Ken John Maghari | Backend / API Developer |
| Hero Pedero | Frontend Developer |
| Anthony Saltat | DevOps Engineer |

## Week 1 Task 2

The repository implements the document catalogue schema, migrations, sample document types and requirements, and a Node.js API that reads PostgreSQL. The Neon development database has been migrated, seeded, and checked through the local API. Backend hosting and public deployed verification remain pending; adding code alone does not deploy the API.

The previous Supabase draft is preserved under `../archive/` for reference. Do not run it against Neon. The Week 1 catalogue schema and the Week 2 application CRUD API are managed by migrations. Applications are scoped to the authenticated Neon Auth user. Uploads, private object storage, and AI analyses remain future work.

## Setup

Run the commands below from `backend/` (`cd backend` from the repository root).

1. Install Node.js 24 LTS and run `npm ci`.
2. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell).
3. In Neon, create/select a development project, branch, and database. Copy both connection strings from **Connect** into `.env`:
   - `DATABASE_URL`: pooled connection (hostname contains `-pooler`).
   - `DIRECT_DATABASE_URL` or `DATABASE_URL_UNPOOLED`: direct connection to the **same branch and database**, used by migration/seed scripts. Do not put the pooled URL in either variable.
4. Use `sslmode=verify-full` in both Neon URLs and preserve `channel_binding=require` if present. The backend upgrades Neon's `sslmode=require` to `verify-full`; this verifies the server certificate and hostname. Do not disable certificate verification. Local PostgreSQL on localhost can use a URL without TLS.
5. Set `FRONTEND_URL` to the React origin (default `http://localhost:5173`, no trailing slash).
6. Set `NEON_AUTH_BASE_URL` to the Managed Auth URL for the same Neon branch. The backend verifies bearer tokens against its JWKS; an optional `NEON_AUTH_JWKS_URL` overrides the derived `/.well-known/jwks.json` URL. Never use a client-supplied user ID as the application owner.
7. Run:

```sh
npm run db:migrate
npm run db:seed
npm run check
npm run dev
```

Use `npm start` for normal operation. The backend starts without making an initial database connection; `/health/ready` verifies connectivity. Never expose database URLs or AI keys to the browser or commit `.env`.

Treat database URLs as passwords. If a URL has been shared in chat, source control, or another public place, rotate its password in Neon and update the local `.env` before using it.

Neon hosts the database; deploy this Node.js API separately. Prefer a separate runtime database role with SELECT access on the two catalogue tables, while the migration role owns the schema. CORS is browser configuration, not authentication.

Connection references: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [node-postgres TLS](https://node-postgres.com/features/ssl).

## API contract

| Method | Path | Response |
|---|---|---|
| GET | `/health` | 200: process is alive |
| GET | `/health/ready` | 200: database reachable; 503: unavailable |
| GET | `/api/document-types` | 200: `{ "data": [...] }`, active document types ordered by name |
| GET | `/api/document-types/:id/requirements` | 200: `{ "data": { "id": "...", "name": "...", "description": "...", "requirements": [...] } }` |
| GET | `/api/applications` | 200: current user's applications, newest updated first |
| POST | `/api/applications` | 201: create a draft from `{ "document_type_id": "...", "purpose": "..." }` |
| GET | `/api/applications/:id` | 200: retrieve one of the current user's applications |
| PATCH | `/api/applications/:id` | 200: update `document_type_id` and/or `purpose` on a draft |
| DELETE | `/api/applications/:id` | 204: delete a draft owned by the current user |
| GET | `/api/applications/:id/files` | 200: list private file metadata for an owned application |
| POST | `/api/applications/:id/files` | 201: upload a raw `text/plain`, PDF, JPEG, or PNG body (2 MiB maximum), with `Content-Disposition: attachment; filename="..."`; drafts only |
| GET | `/api/applications/:id/files/:fileId` | 200: download a private file belonging to the owned application |
| DELETE | `/api/applications/:id/files/:fileId` | 204: delete a file from an owned draft |
| GET | `/api/applications/:id/analyses` | 200: list saved analysis records for an owned application |
| GET | `/api/applications/:id/analyses/:analysisId` | 200: retrieve an analysis belonging to the owned application |
| GET | `/api/applications/:id/checklist` | 200: compute requirement decisions and required-item completeness from the application's saved files and latest valid analyses |
| POST | `/api/applications/:id/analyses` | 201: analyze `{ "file_id": "..." }` from an owned draft; text/plain files only |

Application routes require `Authorization: Bearer <Neon Auth JWT>`. Owner IDs come only from verified token subjects. Every lookup and mutation is owner-scoped; another user's record returns 404. Only drafts can be updated or deleted. Application requests reject unknown fields, invalid UUIDs, non-string or over-200-character purposes, and JSON bodies over 32 KB. A missing or inactive document type returns 422; invalid body data returns 400; attempts to edit or delete a submitted application return 409. Files are stored in PostgreSQL, limited to 2 MiB and an allowlist of media types, and served only as private attachments with `no-store` and `nosniff` headers. File uploads and deletes require a draft application. Analysis accepts only an owned plain-text file from a draft application. The request sends that file's UTF-8 text and the application's requirement names/descriptions to OpenAI using the configured model. Set the server-only `OPENAI_API_KEY`; without it, analysis returns 503. Analysis records are owner- and application-scoped, limited to three attempts per owner per rolling hour, and the provider client caps text at 20 KB, output tokens at 600, retries transient errors for three total attempts with a 10-second timeout, and stores failures without upstream response details.

Analysis output is required to be a JSON object. The backend validates extracted fields and exactly one decision for each persisted requirement, then computes whether the detected document matches the selected service. `GET /api/applications/:id/checklist` aggregates each file's latest valid result; required requirements count as complete only when a matching-service result marks them complete. Invalid AI structure is stored as a safe failed analysis and does not count toward checklist completion.

Each requirement includes `id`, `name`, `description`, `accepted_document_types`, `is_required`, and `sort_order`. Requirements are sorted by sort_order, name, and ID. An empty catalogue or requirement list returns an empty array. Inactive types are hidden. Invalid UUIDs return 400; missing/inactive types and unknown routes return 404 (application creation/update uses 422 for invalid document types). Unexpected API failures return a sanitized 500 error with a request ID.

Quick PowerShell verification after starting the API:

```powershell
Invoke-RestMethod http://localhost:3000/health/ready
$types = Invoke-RestMethod http://localhost:3000/api/document-types
$types.data
$typeId = $types.data[0].id
Invoke-RestMethod "http://localhost:3000/api/document-types/$typeId/requirements"
```

Import `../postman/TSEK Node API.postman_collection.json` to exercise the API. Its list request stores the first document type ID for the requirements and create-application requests. Set the collection variable `authToken` to a current Neon Auth bearer token to run the application requests; it is intentionally blank and must not be committed or shared. The create request stores its new ID for the get, update, and delete requests.

## Database and maintenance

- `db/migrations/001_catalogue.sql`: UUID keys, foreign key, unique constraints, validation checks, and lookup index.
- `db/migrations/003_private_files_and_analyses.sql`: owner-bound private file storage and analysis records with enforced application/file relationships.
- `db/migrations/004_normalized_analysis_results.sql`: normalized JSON results and a latest-result lookup index for persisted checklist decisions.
- `db/seed.sql`: three sample document types and nine sample requirements. These are demonstration defaults, not verified barangay rules; Cedula is conditional.
- `scripts/database-tasks.js`: transactional migrations with a database lock and checksum ledger; repeat runs skip applied migrations. Changed/missing applied migrations fail. Add new numbered SQL files rather than editing an applied migration. Use zero-padded names such as `002_add_column.sql`.
- Seed runs are transactional and repeatable. They insert missing sample rows and preserve existing edits and IDs. Run migration before seeding. Do not automatically seed production.
- This is a fresh Neon schema, not a data-transfer tool. If an existing database already has these tables, use a fresh development branch/database or plan a reviewed migration first.

## Validation

`npm run check` runs ESLint and Node's test runner. Tests execute the actual SQL and repository queries against PGlite (embedded PostgreSQL), plus HTTP tests for success/error/empty/inactive cases, application CRUD and owner isolation, Neon Auth token verification, constraints, transaction rollback, migration repeatability/checksums, seeding, CORS, and configuration. Tests do not require credentials and do not modify Neon. They do not validate Neon networking, TLS, hosted permissions, or deployment; run the setup and HTTP checks against your Neon development database for those.

See [the backend behavior and evidence matrix](../docs/REQUIREMENTS_MATRIX.md) for route-to-test coverage and outstanding upload, analysis, and deployment evidence.

## Workflow and remaining Week 1 work

Week 2 application CRUD is provided by the backend API; wiring the React application-management UI to these routes and verifying the integrated sign-in flow remain separate integration work. Catalogue migrations, seed data, and public routes have been verified against the Neon development database. Backend hosting and public deployed verification remain pending. See `../docs/REQUIREMENTS_MATRIX.md` for behavior and validation evidence.
