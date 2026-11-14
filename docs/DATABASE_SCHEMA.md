# TSEK database schema

This diagram matches migrations `001_catalogue.sql` through
`005_ai_request_budget.sql` on `main`. The file-revision fields proposed in
PR #172's migration 006 are intentionally not shown.

```mermaid
erDiagram
    DOCUMENT_TYPES ||--o{ DOCUMENT_REQUIREMENTS : defines
    DOCUMENT_TYPES ||--o{ APPLICATIONS : selected_for
    APPLICATIONS ||--o{ APPLICATION_FILES : contains
    APPLICATIONS ||--o{ APPLICATION_ANALYSES : has
    APPLICATION_FILES ||--o{ APPLICATION_ANALYSES : analyzed_as

    DOCUMENT_TYPES {
        uuid id PK
        text name UK
        text description
        boolean is_active
        timestamptz created_at
    }
    DOCUMENT_REQUIREMENTS {
        uuid id PK
        uuid document_type_id FK
        text name
        text description
        text_array accepted_document_types
        boolean is_required
        integer sort_order
        timestamptz created_at
    }
    APPLICATIONS {
        uuid id PK
        uuid owner_id "Neon Auth subject"
        uuid document_type_id FK
        text purpose
        text status
        timestamptz created_at
        timestamptz updated_at
    }
    APPLICATION_FILES {
        uuid id PK
        uuid application_id FK
        uuid owner_id
        text original_name
        text media_type
        bytea content
        timestamptz created_at
    }
    APPLICATION_ANALYSES {
        uuid id PK
        uuid application_id FK
        uuid owner_id
        uuid file_id FK
        uuid document_type_id FK
        text status
        jsonb result
        jsonb normalized_result
        text error_code
        jsonb metadata
        timestamptz created_at
    }
    AI_REQUEST_HOURLY_BUDGET {
        boolean singleton PK
        timestamptz hour_start
        integer request_count
    }
    AI_REQUEST_USER_BUDGETS {
        uuid user_id PK
        timestamptz minute_start
        integer minute_count
        timestamptz day_start
        integer day_count
    }
```

## Relationships, constraints, and indexes

- Document type names are unique and cannot be blank. Requirements are unique
  by `(document_type_id, name)` and cascade when their type is deleted.
- Applications reference a document type with `ON DELETE RESTRICT`. The
  `owner_id` is the verified Neon Auth user UUID; there is no local users table
  or foreign key into the external Auth system.
- Files reference an application and its owner together, so a file cannot be
  attached to another owner's application. The original name is 1–128
  characters; content is 1 byte to 2 MiB; media types are plain text, PDF,
  JPEG, or PNG. Each application may have at most 10 files in the API.
- Analysis records reference the owning application, uploaded file, and
  selected document type. A completed record must include raw and normalized
  JSON results; a failed record stores an error code and no result.
- AI budget storage has one shared hourly counter and per-user minute/day
  counters. The API enforces 60 requests per UTC hour across users, 3 per user
  per UTC minute, and 20 per user per UTC day.
- `document_requirements_type_order_idx` orders requirements;
  `applications_owner_updated_idx` serves owner-scoped application lists;
  `application_files_application_idx` serves owner-scoped file lists; and
  `application_analyses_latest_idx` serves recent analyses by application and
  file.

`backend/db/seed.sql` contains demonstration service requirements, not
authoritative rules. Confirm requirements with the issuing barangay. The
schema stores uploaded file bytes in PostgreSQL and does not use object
storage.

