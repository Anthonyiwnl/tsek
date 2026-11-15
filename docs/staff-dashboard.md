# Barangay staff dashboard

The authenticated `#/admin` route is a staff review queue. This deployment is
for one barangay: assigned staff can review all submitted applications in this
database. It does not implement separation between multiple barangays.

## Permissions

| Identity | Allowed access |
| --- | --- |
| Signed out | No private applications or staff endpoints |
| Citizen (default) | Own drafts, documents, submissions, and decision notes |
| Staff | Citizen access plus submitted application queue, original documents, requirement checks, and review decisions |
| Admin | Same review permissions as staff in this release |

Admin is an application role, not a Neon Auth administration role. Neither role
can assign roles through the website. Provisioning remains an operator task.
Client metadata, email names, request headers, and visiting `#/admin` never
grant access. The server checks the role table on each staff request; revocation
takes effect on the next request. Existing citizen endpoints remain owner-scoped.

## Workflow

1. A citizen saves a draft and uploads documents.
2. They confirm submission, which makes their documents available to staff and
   makes the application read-only. Submission requires a purpose, an active
   service, and at least one file. AI completion is not an eligibility gate.
3. Staff open a submitted application, download the evidence, and review the
   current requirement checks. AI results are advisory.
4. Staff choose approve or reject, enter a note visible to the applicant, and
   confirm before saving. The status and reviewer audit record are written
   atomically. A second decision returns 409 instead of overwriting the first.
   Staff cannot approve or reject their own applications; another reviewer must
   make that decision. The rule is enforced in both the route and SQL update.
5. The citizen sees the status and note under “Barangay review.” Decisions are
   final in this release; correction/reopening and certificate issuance are not
   implemented. A rejected applicant can prepare a new application.

## Rollout and account assignment

Apply the migration before merging, following `docs/RUNBOOK.md`, then
merge/deploy through the normal reviewed PR pipeline. No live migration or
account assignment is performed simply by building this branch.

1. Before merging, run `npm run db:migrate --prefix backend` with staging's
   migration connection first, then production's migration connection.
   Record both outcomes in the pull request. Use the target branch's migration
   connection. Migration 006 adds role and audit tables and broadens the status
   constraint. It preserves existing rows and replaces only the old status
   check; do not edit previously applied migrations. Do not roll the constraint
   back once approved/rejected records exist.
2. Deploy the backend before the frontend. The backend runtime needs SELECT on
   `staff_roles`, SELECT/INSERT on `application_reviews`, and its existing
   application/file permissions. It should not have role-table write grants.
3. Keep `VITE_API_BASE_URL` pointed at the backend and its CORS origin configured
   for the frontend. Local Vite proxies `/api/me` and `/api/admin` as well as
   existing application routes. No extra AI credentials are needed.
4. After the user provides their email, create/locate their identity in the
   correct Neon Auth branch using the normal account flow. The user sets their
   password privately. Confirm the email-to-user-ID mapping before assignment.
5. With the migration/operator connection, run:

   ```sh
   npm run staff:role --prefix backend -- <verified-Neon-user-UUID> admin
   ```

   Use `staff` for another reviewer or `citizen` to revoke elevated access.
   The script verifies the identity exists in `neon_auth."user"`; it does not
   create accounts, print credentials, or assign access based on email patterns.
   Neon documents this identity table in its
   [branchable identity overview](https://neon.com/blog/neon-auth-branchable-identity-in-your-database).
6. Sign in at `#/admin`. Verify a citizen receives 403 from `/api/admin/*`, an
   assigned staff user sees only submitted records, and a revoked role is denied.

No admin account, email, password, or implicit default admin is seeded.

## Validation and local preview

Run `npm run check`. Backend integration tests use an isolated PGlite database
and synthetic identities; they exercise actual migrations and SQL without
calling Neon or AI. Frontend tests cover access gating, filtering, pagination,
review confirmation, conflict handling, and submission.

For visual QA, run `npm run dev --prefix frontend -- --host 127.0.0.1` and open
`/tests/fixtures/staff-preview.html`. This is explicitly labeled synthetic data;
it imports the real staff UI with a fixture API. It is not a production entry,
is not reachable from app navigation, and does not bypass live authentication.
