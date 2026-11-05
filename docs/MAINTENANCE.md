# Maintenance plan and handover kit

Could someone else run TSEK next month? This page lists what has to be looked
after, how often, and who holds each account, so the answer is yes (end-term
deck, Module 8; Demo Day readiness question 9: "Is there a written plan for
models, keys, and backups?").

## 1. Who holds what

The **bus factor** is how many people could disappear before nobody can deploy
or fix the system. Every account below has one owner today, so each owner
must make sure a second teammate can get in (invite them as a member, or
record where the login is kept) before Demo Day.

| Service | Used for | Owner | Second person |
|---|---|---|---|
| GitHub `Anthonyiwnl/tsek` | Code, pipeline, environments and secrets | Anthony | Admins on the repository |
| Vercel (`tsek`, `tsek-staging`) | Frontend hosting | Anthony | _to add_ |
| Render (`tsek-api`, `tsek-api-staging`) | Backend hosting | Francis | _to add_ |
| Neon (branches `main`, `staging`) | PostgreSQL database | Francis | _to add_ |
| OpenAI (staging and production projects) | AI provider and API keys | Anthony | _to add_ |

## 2. AI layer

AI quality can change even when our code does not: providers update and retire
models, and users bring new kinds of documents.

**Pin the model.** Set `OPENAI_MODEL` on Render to a dated snapshot, not an
alias. `gpt-4.1-mini` is an alias that OpenAI can move to a newer snapshot; a
dated name (shown on OpenAI's model page, for example
`gpt-4.1-mini-2025-04-14`) cannot change under us. The code default in
`backend/src/config.js` is only a fallback.

**A model upgrade is a code change.** When OpenAI announces a deprecation, or
we want to try a new model:

1. Run the evaluation on the candidate and the current model with the capped
   **staging** key: `node scripts/eval/compare-models.mjs --models openai:<current>,openai:<candidate>`
   (see [`scripts/eval/README.md`](../scripts/eval/README.md)).
2. Compare outcome accuracy, schema match, latency and cost. Commit the
   results under `scripts/eval/results/`.
3. Switch `OPENAI_MODEL` on **staging** first and wait for one daily AI smoke
   test to pass. Then set the same value on production so both environments
   match (production AI stays off until the kill switch rules below allow it).
   Switching back is a settings change, not a deploy.
4. Record the change in `CHANGELOG.md`.

**Prompt changes** go through a pull request with a new version file
(`prompt.v2.md`, …). The eval workflow (`eval-harness.yml`) tests the harness
on the pull request and evaluates the prompt against the real model once it
reaches `main` (needs the `OPENAI_EVAL_API_KEY` secret).

The workflow passes no `--prompt`, so `compare-models.mjs` evaluates
`prompt.v1.md` by default. In the same pull request that adds a version, add
`--prompt scripts/eval/prompt.v2.md` to the live evaluation step in
`eval-harness.yml`. Otherwise a passing run says nothing about the new prompt.
Before accepting it, also run it once yourself with the **staging** key:
`node scripts/eval/compare-models.mjs --prompt scripts/eval/prompt.v2.md --models openai:<current>`.

**Kill switch.** `AI_VERIFY_ENABLED` controls the AI endpoint
(`POST /api/verify`). Today it is `true` only on **staging**
(`tsek-api-staging`). Production keeps it unset or `false` until the route has
authentication and rate limiting ([`AI_PROVIDER.md`](AI_PROVIDER.md)), so
never turn it on there. Setting it to `false` turns the endpoint off without
a deploy (Render restarts the service with the new value); use it when the
provider is down, a key leaks, or spend jumps. It becomes production's kill
switch only after those controls exist and production AI has been enabled
through a reviewed pull request.

**Feed failures back.** Any wrong answer someone reports becomes a new case in
the evaluation dataset (new dataset version) before the prompt is changed to
fix it.

## 3. Keys and secrets

| Rule | How |
|---|---|
| One key per environment | Staging and production use separate OpenAI projects and keys, and separate `JWT_SECRET`s |
| Spend caps | Each OpenAI project has a monthly budget; staging's is the lowest. Check both in the weekly review |
| Where secrets live | Runtime secrets in each Render service; deploy hooks in the GitHub `staging` and `production` environments; never in the repository (the secret scan blocks it) |
| Rotation | At the end of the course, and immediately after any leak: follow [`RUNBOOK.md`](RUNBOOK.md) §4. Rotating `JWT_SECRET` signs everyone out |
| Leaving members | Remove them from every service in §1 and rotate any key they could see |

## 4. Database and backups

- **Point-in-time recovery.** Neon keeps the history of each branch for the
  plan's retention window, so production can be recovered to a time before a
  problem by creating a branch from that point. The steps are in
  [`RUNBOOK.md`](RUNBOOK.md) §2c. Practise on `staging` first.
- **Before risky changes** (a migration that changes or deletes data, a bulk
  fix): create a Neon branch of production named `backup-YYYY-MM-DD` first.
  Delete it after the change is verified.
- **Migrations only move forward.** Undo a bad migration with a new migration
  through a pull request. Change columns in two steps (expand, then contract)
  so the old and new code both work during a deploy.
- **Export before the project ends.** Run `pg_dump` against the direct
  production URL and keep the file outside the repository if the data must
  outlive the Neon project.

## 5. Dependencies and security

| What | When | Who |
|---|---|---|
| Dependabot grouped minor/patch updates (frontend, backend, Actions) | Mondays; review and merge within the week | Any teammate reviews; the reviewer adds `Closes #N` |
| Major updates | One pull request each; test on staging before merging | The owner of that app |
| Security scan (`security.yml`) | Mondays 09:17 PHT | DevOps reads the result |
| Node.js version | Node 24 in CI and the Dockerfile; keep Render and Vercel on the same major version and change them together | DevOps |

## 6. Weekly cost review

Every Monday, before the stand-up, DevOps checks and posts in the team chat:

| Check | Where | Act when |
|---|---|---|
| AI spend against the cap, staging and production | OpenAI → Usage, per project | Over half the cap before mid-month |
| Render instance hours used | Render → Billing | Over 600 of the 750 free hours |
| Vercel plan, deployments and renewal or trial end date | Vercel → Settings → Billing | A trial or plan ends before Demo Day |
| Neon storage and compute hours | Neon → Billing | Near the free limit |
| Unused resources (old Neon branches, preview deployments, extra services) | Each dashboard | Delete them |

Know what sleeps or expires before Demo Day: Render's free services sleep
after 15 idle minutes and take up to about 50 s to wake.

## 7. Handover kit

Everything a new teammate needs, in one place:

| Need | File |
|---|---|
| Setup and run steps, roles, stack | [`README.md`](../README.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Environments and how they were set up | [`STAGING.md`](STAGING.md), `.env.example` files |
| Install, migrate, seed | `npm run setup`, then `npm run db:migrate --prefix backend` and `npm run db:seed --prefix backend` (or `docker compose up`) |
| Pipeline: every stage and why | [`PIPELINE.md`](../PIPELINE.md) |
| Deploy, rollback, leaked secret, Demo Day | [`RUNBOOK.md`](RUNBOOK.md) |
| Targets and alerts | [`SLO.md`](SLO.md) |
| What went wrong before | [`INCIDENTS.MD`](INCIDENTS.MD) |
| AI provider, failure drill, evaluation | [`AI_PROVIDER.md`](AI_PROVIDER.md), [`AI_FAILURE_DRILL.md`](AI_FAILURE_DRILL.md), [`scripts/eval/README.md`](../scripts/eval/README.md) |
| Architecture, database schema, API reference | #39 (in progress) |
