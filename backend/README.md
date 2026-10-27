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

The repository implements the document catalogue schema, migrations, sample document types and requirements, and a Node.js API that reads PostgreSQL. Live Neon setup and verification are still required; adding code alone does not create a hosted database.

The previous Supabase draft is preserved under `../archive/` for reference. Do not run it against Neon. This implementation intentionally begins with the two catalogue tables requested for Week 1. Users, application CRUD, authentication, uploads, private object storage, and AI analyses from the full proposal remain future work. The public API exposes only catalogue data.

## Setup

Run the commands below from `backend/` (`cd backend` from the repository root).

1. Install Node.js 24 LTS and run `npm ci`.
2. Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell).
3. In Neon, create/select a development project, branch, and database. Copy both connection strings from **Connect** into `.env`:
   - `DATABASE_URL`: pooled connection (hostname contains `-pooler`).
   - `DIRECT_DATABASE_URL` or `DATABASE_URL_UNPOOLED`: direct connection to the **same branch and database**, used by migration/seed scripts. Do not put the pooled URL in either variable.
4. Use `sslmode=verify-full` in both Neon URLs and preserve `channel_binding=require` if present. The backend upgrades Neon's `sslmode=require` to `verify-full`; this verifies the server certificate and hostname. Do not disable certificate verification. Local PostgreSQL on localhost can use a URL without TLS.
5. Set `FRONTEND_URL` to the React origin (default `http://localhost:5173`, no trailing slash).
6. Run:

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

Each requirement includes `id`, `name`, `description`, `accepted_document_types`, `is_required`, and `sort_order`. Requirements are sorted by sort_order, name, and ID. An empty catalogue or requirement list returns an empty array. Inactive types are hidden. Invalid UUIDs return 400; missing/inactive types and unknown routes return 404. Unexpected API failures return a sanitized 500 error with a request ID.

Quick PowerShell verification after starting the API:

```powershell
Invoke-RestMethod http://localhost:3000/health/ready
$types = Invoke-RestMethod http://localhost:3000/api/document-types
$types.data
$typeId = $types.data[0].id
Invoke-RestMethod "http://localhost:3000/api/document-types/$typeId/requirements"
```

Import `../postman/TSEK Node API.postman_collection.json` to exercise the API. Its list request stores the first document type ID for the requirements request.

## Database and maintenance

- `db/migrations/001_catalogue.sql`: UUID keys, foreign key, unique constraints, validation checks, and lookup index.
- `db/migrations/002_applications.sql`: the `applications` table, which links an owner to a document type, plus an owner lookup index. See "Applications and ownership" below.
- `db/seed.sql`: three sample document types and nine sample requirements. These are demonstration defaults, not verified barangay rules; Cedula is conditional.
- `scripts/database-tasks.js`: transactional migrations with a database lock and checksum ledger; repeat runs skip applied migrations. Changed/missing applied migrations fail. Add new numbered SQL files rather than editing an applied migration. Use zero-padded names such as `002_add_column.sql`.
- Seed runs are transactional and repeatable. They insert missing sample rows and preserve existing edits and IDs. Run migration before seeding. Do not automatically seed production.
- This is a fresh Neon schema, not a data-transfer tool. If an existing database already has these tables, use a fresh development branch/database or plan a reviewed migration first.

## Applications and ownership

`applications` stores one citizen's request for one document type.

| Column | Meaning |
|--------|---------|
| `owner_id` | Required. The verified subject (`sub`) of the user's auth token. The API takes it only from a verified token, never from the request body. |
| `document_type_id` | Required. Foreign key to `document_types`. A type that has applications cannot be deleted (`ON DELETE RESTRICT`); deactivate it with `is_active = false` instead. |
| `purpose` | The citizen's stated purpose, at most 200 characters. |
| `status` | `draft` (default) or `submitted`. |
| `created_at`, `updated_at` | Timestamps. |

Relationships:

```
auth identity (token sub) 1 ──< applications >── 1 document_types 1 ──< document_requirements
```

`owner_id` has no foreign key because user identities live in the auth provider, not in this schema. An application reaches its requirements through its document type.

### Planned for Sprint 3: uploads

Uploads are not stored yet. Sprint 3 adds a table linking each uploaded file to one application and the requirement it satisfies:

| Planned column | Meaning |
|----------------|---------|
| `application_id` | Foreign key to `applications`, `ON DELETE CASCADE`, so deleting a draft removes its upload records. |
| `requirement_id` | Foreign key to `document_requirements`, so each file answers one requirement of that application's document type. |
| `storage_key` | Location of the file in private object storage. The file itself is never stored in PostgreSQL. |
| `mime_type`, `size_bytes`, `uploaded_at` | File metadata for validation and display. |

AI extraction results will reference the upload they came from. This design is a plan; it is created by a later numbered migration.

## Validation

`npm run check` runs ESLint and Node's test runner. Tests execute the actual SQL and repository queries against PGlite (embedded PostgreSQL), plus HTTP tests for success/error/empty/inactive cases, constraints, transaction rollback, migration repeatability/checksums, seeding, CORS, and configuration. Tests do not require credentials and do not modify Neon. They do not validate Neon networking, TLS, hosted permissions, or deployment; run the setup and HTTP checks against your Neon development database for those.

## Workflow and remaining Week 1 work

Create a feature branch, make changes, run checks, open a pull request into main, review, then merge through the team's workflow. The React UI, sample checklist, and GitHub Actions workflow are now present on the integration branch. API integration into the UI, live Neon verification, the AI provider test, hosting setup, and deployed verification remain pending. See `../docs/LOCAL_INTEGRATION.md` for running both components and the review workflow.
