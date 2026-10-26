# TSEK frontend

React + Vite frontend for TSEK. See the repository README and
`../docs/LOCAL_INTEGRATION.md` for setup and deployment instructions.

- `npm ci`: install dependencies from the lockfile
- `npm run dev`: start the development server
- `npm run lint`: check source code
- `npm test`: test the frontend API clients
- `npm run typecheck`: check TypeScript
- `npm run build`: build to `dist/`
- `npm run preview`: preview the production build locally

The authenticated **My applications** page creates, reads, edits, and deletes
draft application records through the backend API. Configure
`VITE_NEON_AUTH_URL` for sign-in. In production, configure
`VITE_API_BASE_URL` with the backend origin. Local Vite development proxies
`/api` to `http://localhost:3000` by default.

The frontend does not upload documents or run AI analysis yet.
