# Contributing to TSEK

## Workflow: 1 issue = 1 branch = 1 pull request

1. Pick an issue assigned to you. If the work has no issue yet, create one first.
2. Pull the latest `main` before you start:

   ```
   git checkout main
   git pull
   ```

3. Create the branch from the issue page (**Development → Create a branch**) so GitHub links it, or name it `<issue-number>-short-description`, for example `26-private-uploads`.
4. Write commit messages in Conventional Commits style: `feat(backend): ...`, `fix(frontend): ...`, `docs: ...`, `ci: ...`.
5. Open a pull request into `main` and write `Closes #<issue number>` in the description. Add one line per issue if the PR completes more than one.
6. Request a review from a teammate. Answer and resolve every review conversation, including CodeRabbit's.
7. Merge only after the required checks pass and a teammate approves.

Issues without code (sprint evidence, documentation, release records) still get a pull request that adds the evidence under `docs/`.

## Rules enforced on `main`

- Direct pushes are blocked. Every change arrives through a pull request.
- One approving review from a teammate is required. Authors cannot approve their own pushes, and new commits dismiss earlier approvals.
- Required check: `Install, lint, build, and test`. The `PR links an issue` check runs on every pull request into `main` and becomes required once it is on `main`.
- Branches must be up to date with `main` before merging.
- All review conversations must be resolved before merging.
- Administrators cannot bypass these rules. Force pushes and deleting `main` are blocked.

## Secrets

Never commit `.env` files, API keys, or database URLs. Add new variable names to `.env.example` without values. If a secret leaks, tell the DevOps engineer immediately so it can be rotated.

## Dependency updates

Dependabot opens grouped update pull requests every Monday for the frontend,
the backend and GitHub Actions. Treat them like any other pull request: the
checks must pass and a teammate reviews them. Dependabot cannot write
`Closes #N`, so before merging the reviewer creates an issue for the update
and edits the pull request description to add `Closes #N`. That re-runs the
`PR links an issue` check.
