# TSEK frontend

React, TypeScript and Vite. See the repository README for setup and deployment.

- `npm ci`: install locked dependencies
- `npm run dev`: run locally (API proxy defaults to http://127.0.0.1:3000)
- `npm run lint`, `npm run build`, `npm test`: validate the frontend

`src/App.tsx` owns routing. `#/applications` opens authenticated application CRUD,
private document uploads, analysis and saved requirement checklists. Analysis
currently accepts plain-text `.txt` files, up to 2 MiB and 1–10,000 characters.
Replacement uses `PUT /api/applications/:id/files/:fileId`, atomically replacing
both the original file and its old analysis before analyzing the new file ID.
If analysis fails, the replacement remains saved and can be retried.

`#/dashboard` and `#/admin` read authenticated API records. The current backend
is owner-scoped: staff-wide queues and review actions are not implemented.
No demo records or inferred readiness percentages are displayed.

Configure public `VITE_NEON_AUTH_URL` and optionally `VITE_API_BASE_URL` for
sign-in and API access. Provider secrets remain exclusively on the backend.
Tests mock analysis and never call the live AI provider.
# Test runner dependency isolation

Vitest is installed under the development-only npm alias `@tsek/test-runner`.
The alias uses the same official Vitest package and version range; its `vitest`
command and test imports remain unchanged. `vitest.config.js` imports the
configuration helper through the alias.

Better Auth (used by Neon Auth) declares an optional `vitest` peer for its
test utilities. Installing our runner under that name makes npm classify the
runner, Vite, and their glob dependencies as production-optional dependencies.
TSEK does not use Better Auth's test utilities. The alias keeps that peer absent
and keeps the tools in the development tree. Do not add a second dependency
named `vitest` without rechecking the production tree.

The security workflow is unchanged: `npm audit --omit=dev --audit-level=high`
checks production dependencies, and `npm audit --audit-level=critical` checks
the full tree. The full audit still reports the development-tooling
[picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf); this change
does not patch or suppress it. Avoid running development tools on untrusted
glob patterns until an upstream fix is available.
