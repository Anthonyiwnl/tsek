# Authenticated application workflows

PR #59 supplies existing-account Neon sign-in and application creation on current main.
The public login/get-started links open #/applications. Catalogue and application
creation use the backend API; failed saves preserve entered fields.
Configure VITE_NEON_AUTH_URL to the same Neon Auth instance as the backend.
VITE_API_BASE_URL defaults to /api; development and Vercel proxy these routes.

PR #54 adds list/details and PR #55 adds draft edit/delete as a review stack.
Upload/analysis work remains in PR #56 and is excluded from this stack.

Automated tests use synthetic accounts and mocked network responses; they do
not prove a live user's authenticated acceptance. See PRs for validation results.
