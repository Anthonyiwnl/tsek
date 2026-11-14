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
