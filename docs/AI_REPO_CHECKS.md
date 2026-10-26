# AI Repository Checks

TSEK checks every pull request with three automated layers, plus a manual
REA audit of what we actually ship.

| Check | Runs when | Blocks merging? |
|---|---|---|
| CodeRabbit review | Every non-draft pull request, including stacked ones | No. Its conversations must be resolved before merging. |
| TSEK AI review (`ai-review.yml`) | Every non-draft pull request | No. Advisory, so an OpenAI outage never blocks work. |
| Frontend bundle audit (`bundle-audit.yml`) | Pull requests and pushes to `main` that change `frontend/` | Yes, when it finds a secret or direct OpenAI or database access. |
| REA audit | Manually, before each consultation and before Demo Day | Not applicable |

AI reviews never replace the required teammate approval.

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

- Pull requests from forks are skipped because they cannot read secrets.
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
| 2026-10-27 | `frontend/src` with REA; built bundle `frontend/dist` with a text search (`main` at `c467bc3`) | None. The only `fetch` is Vite loading its own files; `w3.org` and `react.dev` strings are not requests | No | Pass | REA timed out twice on the 221 KB minified bundle (120 s and 600 s), so the bundle was checked by text search. The frontend makes no data or AI requests yet; re-run on staging once it calls the backend. |
