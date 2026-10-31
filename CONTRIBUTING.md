# Contributing to TSEK

## Workflow: 1 issue = 1 branch = 1 pull request

Each task gets its own issue, its own branch, and its own pull request. Open
the pull request as soon as that task is done. Do not hold work back and merge
several tasks together, because small pull requests get reviewed faster and
show who did what.

1. Pick an issue assigned to you. If the work has no issue yet, create one
   first using an issue template. Keep issues to a day or two of work.
2. Before you pull, make sure your own workspace is clean: commit or stash your
   changes and confirm they pass the checks (step 5). Then update `main`:

   ```
   git checkout main
   git pull
   npm run check
   ```

   If `npm run check` fails on a fresh `main`, tell the team before starting.
3. Create the branch from the issue page (**Development → Create a branch**)
   so GitHub links it, or name it `<issue-number>-short-description`, for
   example `26-private-uploads`.
4. Write commit messages in Conventional Commits style: `feat(backend): ...`,
   `fix(frontend): ...`, `docs: ...`, `ci: ...`.
5. Before every push, run the same checks as CI from the repository root:

   ```
   npm run check
   ```

   It runs lint, build and tests for both apps without installing anything.
   After a pull that changed dependencies, run `npm run setup` first.
6. Open a pull request into `main` and write `Closes #<issue number>` in the
   description. **Close exactly one issue.** The `PR links an issue` check
   fails if the description closes none or more than one.
7. Request a review from a teammate. Answer and resolve every review
   conversation, including CodeRabbit's.
8. Merge only after the required checks pass and a teammate approves.

Issues without code (sprint evidence, documentation, release records) still get a pull request that adds the evidence under `docs/`.

## Rules enforced on `main`

- Direct pushes are blocked. Every change arrives through a pull request.
- One approving review from a teammate is required. Nobody can approve their own pull request or their own latest push, and new commits dismiss earlier approvals.
- Required checks: `Install, lint, build, and test` and `PR links an issue` (exactly one `Closes #N`).
- Branches must be up to date with `main` before merging.
- All review conversations must be resolved before merging.
- Administrators cannot bypass these rules. Force pushes and deleting `main` are blocked.

## Secrets

Never commit `.env` files, API keys, or database URLs. Add new variable names to `.env.example` without values. If a secret leaks, tell the DevOps engineer immediately so it can be rotated.
