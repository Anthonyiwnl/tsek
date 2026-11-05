# TSEK pipeline

How a change gets from a developer's commit to production, and why each
stage exists. CI and deployment workflows run on GitHub Actions; Vercel
builds pull request previews through its own Git integration. Hosting: Vercel
(frontend), Render (backend), Neon (PostgreSQL).

Related: [deploy and rollback runbook](docs/RUNBOOK.md) ·
[environments](docs/STAGING.md) · [CI/CD setup](docs/CI_CD.md) ·
[metrics log](docs/PIPELINE_METRICS.MD) ·
[optimization log](docs/OPTIMIZATION_LOG.MD) ·
[incident log](docs/INCIDENTS.MD)

**Status key:** **Live** = on `main` today. **PR #N** = written and waiting
for review in that pull request; it is listed so the plan is visible, but it
is not running yet.

## Diagram

```mermaid
flowchart LR
  dev([Developer pushes a branch<br/>for one issue]) --> pr{{Pull request into main}}

  subgraph PR["Pull request checks (fail fast, cheap first)"]
    direction TB
    link["PR links an issue<br/>exactly one Closes #N"]
    checks["Install, lint, build, and test<br/>frontend lint · type check · build · tests<br/>backend lint · API tests (LLM mocked)"]
    sec["Security<br/>npm audit · Gitleaks full history"]
    img["Backend container<br/>image build + PostgreSQL integration<br/>(backend changes only)"]
    bundle["Bundle audit<br/>no secrets or direct AI/DB calls<br/>(frontend changes only)"]
    ai["AI review + CodeRabbit<br/>advisory, never blocking"]
    preview["Vercel preview deploy"]
  end

  pr --> link & checks & sec & img & bundle & ai & preview
  link & checks --> review{"Teammate approves<br/>(no self-approval)"}
  review --> merge([Merge to main])

  subgraph MAIN["On merge to main"]
    direction TB
    mchecks["Checks again on the merged commit"] --> sdeploy["Deploy staging<br/>Vercel + Render hooks"]
    sdeploy --> ssmoke["Smoke test staging<br/>/health reports this commit · frontend tsek-commit · DB endpoint"]
    ssmoke --> pdeploy["Deploy production"]
    pdeploy --> psmoke["Smoke test production"]
  end

  merge --> mchecks
  psmoke --> live([Production = main])

  subgraph OTHER["Scheduled and manual"]
    direction TB
    weekly["Weekly security scan"]
    daily["Daily live AI smoke test (staging key)"]
    uptime["Hourly production uptime check (SLO)"]
    deps["Weekly Dependabot updates"]
    rollback["Rollback: opens a revert PR"]
    release["Tag vX.Y.Z: GitHub Release"]
  end
```

## Pull request stages

They run in parallel when a pull request into `main` is opened or updated.
Inside the main check job, cheap steps run before expensive ones, so a lint
error fails in seconds before the build and tests run. Superseded runs on the
same pull request are cancelled.

| # | Stage | Workflow / job | Why it exists | Trigger | Blocks merge? | Status |
|---|---|---|---|---|---|---|
| 1 | Issue link | `pr-issue-link.yml` / **PR links an issue** | Every change traces to exactly one issue (1 issue = 1 PR), which keeps PRs small and the board accurate | PR opened, edited, updated | Yes (required) | Live; "exactly one" in PR #82 |
| 2 | Component check | `ci.yml` ("Pull request checks") / Install, lint, build, and test | Fails if `frontend/` or `backend/` lockfile is missing instead of silently skipping their checks | PR, and every push to `main` through `deploy-main.yml` | Yes (required) | PR #81 |
| 3 | Install | same job | Clean, reproducible install from each `package-lock.json` (`npm ci`) | same | Yes | Live |
| 4 | Lint | same job | Cheapest check; catches mistakes before anything is built | same | Yes | Live (backend made mandatory in PR #81) |
| 5 | Type check + build | same job (`npm run build` runs `tsc --noEmit` then Vite) | The frontend must compile and type-check to be deployable | same | Yes | Live |
| 6 | Frontend unit tests | same job | Checklist logic and the services API helper keep working | same | Yes | PR #83 |
| 7 | Backend API tests (LLM mocked) | same job (`npm test --prefix backend`) | CRUD, validation, error handling and AI-provider failures tested without paid or flaky live AI calls | same | Yes | Live; mandatory (no `--if-present`) in PR #81 |
| 8 | Dependency audit | `security.yml` / Dependency audit (frontend, backend) | No shipped dependency with a high or critical advisory | PR, push to `main`, Mondays | After it is made required | PR #84 |
| 9 | Secret scan | `security.yml` / Secret scan (full history) | Detects known key, password and token patterns in every commit of the Git history | PR, push to `main`, Mondays | After it is made required | PR #84 |
| 10 | Container + integration test | `container.yml` / Build image and test against PostgreSQL | Builds the backend image (layer-cached) and checks migrations, seed and the API against a real PostgreSQL | PR or push touching `backend/**` (path filter) | No (path-filtered) | PR #91 |
| 11 | Bundle audit | `bundle-audit.yml` / Frontend bundle audit | The built frontend must not contain secrets or call OpenAI or the database directly (core requirement 3) | PR or push touching `frontend/**` | No (path-filtered) | Live |
| 12 | AI review | `ai-review.yml` / TSEK AI review, plus CodeRabbit | Automated reviewer whenever a PR is opened, updated, reopened or marked ready, drafts and forks included (mentor requirement); on forks, which cannot read the key, only the automatic checks run and the summary says why; secrets are redacted before the diff is sent | PR opened, updated, ready for review | No: advisory, and a provider outage never blocks work | Live |
| 13 | Preview deploy | Vercel Git integration | A live preview URL for each PR, so reviewers can check behavior | PR | No | Live |
| 14 | Peer review | Branch protection on `main` | A teammate approves; authors cannot approve their own latest push; admins cannot bypass | PR | Yes | Live |

## Merge to `main`: continuous deployment

`deploy-main.yml` ("CI and deployment") runs only on pushes to
`main`: it calls `ci.yml` to run the same checks on the merged commit, then
calls `deploy.yml` once per environment. Production runs only if staging
passed. The deploy jobs live in their own workflow so pull requests never list
them as skipped (#94). Only the two deploy hook secrets are passed to the
deploy jobs (PR #96).

| # | Stage | Why it exists | Fails when | Status |
|---|---|---|---|---|
| 15 | Checks on the merged commit | The merge result, not just the branch, must pass | Any check fails | Live |
| 16 | Deploy staging | Every merge deploys automatically, first to a safe environment (Neon `staging` branch, staging key with a spending limit) | A deploy hook fails. A missing hook secret is skipped and reported in the summary today; PR #67 makes it fail before either hook runs | Live |
| 17 | Smoke test staging | Proves staging serves **this** commit: backend `/health` reports it, the frontend's `tsek-commit` meta tag matches, and the database-backed endpoint answers | A configured check fails, or the backend or frontend still serves an older commit after the time limit. An unset URL skips its check and is reported in the summary today; PR #67 makes it fail first | Live; needs `/health` commit (PR #58). Hosting is configured for both environments (1 Nov) |
| 18 | Deploy production | Only a release that passed in staging reaches users | Same as 16 | Live |
| 19 | Smoke test production | Health check after release; the run summary is the team notification | Same as 17 | Live |

**Pending, PR #100 (issue #99, a measured optimization):** when it merges,
each environment's deploy and smoke test (rows 16–17, and 18–19) will run as
one job, "Deploy and smoke test", and every setting will be checked before
either hook runs. The stages and their order will stay the same; only two job
start-ups will go away. Until then they run as separate jobs.

If `main` moves on while a deploy is waiting, the older run skips deploying,
because deploy hooks always build the newest commit. The newer run deploys and
tests that commit instead.

## Scheduled, manual and tag-triggered

| Stage | Workflow | Why it exists | Trigger | Status |
|---|---|---|---|---|
| Weekly security scan | `security.yml` | New advisories appear without code changes | Mondays 09:17 PHT | PR #84 |
| Live AI smoke test | `ai-smoke.yml` | The only live AI call: one synthetic request a day to staging, checking the answer's shape. Kept out of the deploy path so an AI outage never blocks a deploy | Daily 08:43 PHT, manual | PR #90 |
| Uptime monitor | `uptime.yml` | The smoke tests only run after a merge; this catches production going down on its own. Measures the 7-day SLI against the SLO in `docs/SLO.md`. Hourly, not more often, so it does not use up Render's shared free hours | Hourly at :17, manual | #118 |
| Dependency updates | `dependabot.yml` | Keeps npm packages and Actions current through normal PRs | Mondays | PR #86 |
| Rollback | `rollback.yml` | Opens a reviewed revert PR for a bad commit, so `main` matches production after an emergency host rollback | Manual | PR #88 |
| Release | `release.yml` | Publishes a GitHub Release from `CHANGELOG.md`, only for a tag on `main` whose pipeline passed | Push of a `vX.Y.Z` tag | PR #89 |

## AI-aware practices

- **Cost:** the provider is mocked in every CI test. Apart from real user
  traffic, the only live call will be the daily smoke test, which is planned
  until PR #90 merges.
- **Non-determinism:** tests and the smoke test check the shape and validity
  of AI output, never exact wording.
- **Outages:** AI review is advisory and the AI smoke test is a separate
  workflow, so a provider outage cannot block merging or deploying.
- **Keys:** separate OpenAI keys per environment, with a spending limit on
  staging. The bundle audit fails if a key or a direct OpenAI call reaches the
  frontend.
- **Prompts are code:** planned under #31/#32. When prompt or schema files
  change, the evaluation set runs and reports whether quality held.

## Secrets

App and deploy secrets live in host dashboards (Render, Vercel) and GitHub
environment secrets scoped to `staging` or `production`, never in the
repository. The one exception is `AI_REVIEW_OPENAI_API_KEY`, a **repository**
secret, because the pull request AI review is not tied to an environment; it
uses its own OpenAI key, separate from the app's keys. The full-history secret scan (PR #84)
found no detectable secret on the scanned branch; once merged it checks every
pull request, every push to `main`, and every week. A clean scan means nothing
*detectable* was found, not proof that nothing exists. The variable names and where each one lives are listed in
[`.env.example`](.env.example).

## Measuring the pipeline

Durations, success rate, deploys, lead time and time to recover are recorded
every sprint in [`docs/PIPELINE_METRICS.MD`](docs/PIPELINE_METRICS.MD), from the
GitHub Actions API. Each optimization is applied one at a time with before and
after numbers in [`docs/OPTIMIZATION_LOG.MD`](docs/OPTIMIZATION_LOG.MD) (#37).
