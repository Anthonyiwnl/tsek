# AI Repository Checks

TSEK checks every pull request with four automated layers, plus a manual
REA audit of what we actually ship.

| Check | Runs when | Blocks merging? |
|---|---|---|
| Claude review (`claude-review.yml`) | Every pull request, when opened, updated, reopened, or marked ready | No. Its conversations must be resolved before merging. |
| CodeRabbit review | On request (`@coderabbitai review`); its free plan has no automatic reviews for this repository | No. Its conversations must be resolved before merging. |
| TSEK AI review (`ai-review.yml`) | Every pull request, including drafts | No. Advisory, so an OpenAI outage never blocks work. |
| Frontend bundle audit (`bundle-audit.yml`) | Pull requests and pushes to `main` that change `frontend/` | Yes, when it finds a secret or direct OpenAI or database access. |
| REA audit | Manually, before each consultation and before Demo Day | Not applicable |

AI reviews never replace the required teammate approval.

## Claude review

The [Claude Code GitHub Action](https://code.claude.com/docs/en/github-actions)
reviews every pull request automatically, the way CodeRabbit did before its
free plan stopped automatic reviews here (#126). It replaced Greptile (#131).
Project rules for every coding agent live in [`AGENTS.md`](../AGENTS.md);
`CLAUDE.md` imports it.

**Automatic review** (`claude-review.yml`, skill
[`tsek-review`](../.claude/skills/tsek-review/SKILL.md)):

- Posts one **summary comment** (merge risk, summary, walkthrough, findings
  table) and keeps it up to date on later pushes.
- Posts each finding as an **inline comment** with its severity
  (Critical, Major, Minor) and, when it is a direct replacement, a
  **suggestion** you can commit with one click.
- On later pushes it reviews **only the new commits**, and pushes that only
  merge `main` ("Update branch") are not re-reviewed.
- It **re-checks its open findings** on every run: fixed ones get a
  "Verified fixed in `sha`" reply and are resolved; the rest stay open.
- Reports defects only, after confirming them in the code, including files
  outside the diff.

**On request**, in a top-level pull request comment (`claude.yml`):

| Comment | What happens |
|---|---|
| `@claude fix` | Fixes the open findings (skill [`tsek-fix`](../.claude/skills/tsek-fix/SKILL.md)), runs `npm run check`, pushes one commit, and replies in each thread. The next review verifies and resolves them. |
| `@claude review` | Reviews again now. |
| `@claude <question>` | Answers a question about the change. |

Only teammates with write access can trigger it. Mention `@claude` in a
top-level comment, not in a reply inside a review thread.

**Setup and cost.** It runs on the DevOps engineer's Claude subscription
through the `CLAUDE_CODE_OAUTH_TOKEN` repository secret (created with
`claude setup-token`) and the Claude GitHub App installed on the repository.
It has no per-review credits, but it uses that subscription's usage limits.
If the secret is missing, or the pull request comes from a fork or a bot, the
job passes with a notice instead of reviewing.

## CodeRabbit

`.coderabbit.yaml` tells CodeRabbit about TSEK's rules: the frontend never
calls OpenAI or the database, the backend validates AI output, SQL is
parameterized, and tests mock the AI provider.

- Comment `@coderabbitai review` on a pull request to request a new review.
- Answer or fix each comment, then click **Resolve conversation**. The `main`
  branch rule requires all conversations to be resolved.

## TSEK AI review

`.github/scripts/ai-review.mjs` runs on every pull request:

1. Collects the diff, leaving out lock files, build output, and images.
2. Runs automatic checks on the added lines: possible API keys, tokens,
   private keys, database URLs with passwords, and frontend code that calls
   OpenAI, connects to the database, or reads server secrets.
3. Replaces anything that looks like a secret with `[REDACTED]` before the
   diff is sent to OpenAI: keys, tokens, whole private key blocks, database
   URLs with passwords, and `SECRET=`, `PASSWORD=`, `TOKEN=` or `API_KEY=`
   assignments. Redaction runs before a long diff is cut short.
4. Asks `gpt-4.1-mini` for a structured review (summary, risk, findings, and
   the project rules) using a JSON schema.
5. Validates the response before posting it. Invalid output, timeouts, and
   provider errors are retried once where useful and then reported in the
   comment instead of failing the job.
6. Posts one comment on the pull request and updates it on every new push.

The reviewer uses the same pattern TSEK uses for documents: structured AI
output, validated by code before anything acts on it.

### Setup

1. In OpenAI, create a project named `tsek-ci` with a low monthly budget and
   create an API key in it. Do not reuse the production key.
2. In GitHub, open **Settings → Secrets and variables → Actions → New
   repository secret**, name it `AI_REVIEW_OPENAI_API_KEY`, and paste the key.

Until the secret exists, the comment still shows the automatic checks and
says the AI review was skipped.

### Notes

- Pull requests from forks cannot read the API key, so on them the job runs
  only the automatic checks and its summary says why the AI part did not run.
  It is never reported as skipped (#93).
- The script runs from the pull request branch, so only collaborators should
  have write access to this repository.
- To use another model, set `AI_REVIEW_MODEL` in the workflow step.

## Frontend bundle audit

After building the frontend, `bundle-audit.yml` searches every file in `frontend/dist` for
OpenAI keys, the OpenAI API endpoint, database connection strings, Neon
hosts, and server secret names. It prints only file names, never the matched
text, so a leaked key is not copied into the public log.

If it fails, move the code that needs the secret to the backend, rotate any
key that was exposed, and tell the DevOps engineer.

## REA audit

[REA (Reverse Engineer Anything)](https://github.com/morluto/rea) is an MCP
server and skill that lets an AI agent analyze shipped software, including
websites and JavaScript bundles. TSEK uses it to check what we actually
deploy, which the source code alone cannot prove.

Use REA only on software we own or are authorized to analyze, such as our
own builds and deployments. Do not point it at CodeRabbit, OpenAI, or any
other third-party service.

### Setup

1. Install Node.js 22 or later.
2. Run `npx rea-agents setup`, choose Claude Code, review the proposed
   changes, and approve them.
3. Restart Claude Code.

### Run the audit

Audit the local build now, then the staging URL once it is deployed:

```
npm run build --prefix frontend
```

Then ask the agent:

> Use REA to analyze our TSEK frontend at `frontend/dist` (or the staging
> URL). List every host the app sends requests to, check the JavaScript for
> API keys, tokens, or database connection strings, and confirm that all
> data and AI requests go through our backend API. Report evidence and
> limitations.

### Expected result

- The frontend sends requests only to the TSEK backend (and Vercel assets).
- No API keys, tokens, or connection strings appear in the bundle.
- No requests go to `api.openai.com` or the database.

### Results

| Date | Target | Hosts contacted | Secrets found | Result | Notes |
|---|---|---|---|---|---|
| 2026-10-27 | `frontend/src` with REA; built bundle `frontend/dist` with a text search (`main` at `c467bc3`) | None. The only `fetch` is Vite loading its own files; `w3.org` and `react.dev` strings are not requests | No | Incomplete | REA timed out twice on the 221 KB minified bundle (120 s and 600 s), so the bundle was checked by text search. The required REA audit of `frontend/dist` or the staging URL remains outstanding; complete it and record evidence and limitations before marking Pass. The frontend makes no data or AI requests yet. |
