# AI provider failure drill

How to simulate an OpenAI failure and show that TSEK handles it (#103). The
backend must stay up, keep serving everything that does not need AI, and
return a clean JSON error that leaks no key or provider detail.

## What the API returns

From `backend/src/provider.js` (#42):

| Failure | HTTP status | `error.code` |
|---|---|---|
| No `OPENAI_API_KEY` on the server | 503 | `MISSING_CREDENTIALS` |
| OpenAI slower than `OPENAI_TIMEOUT_MS` (default 10 s) | 504 | `PROVIDER_TIMEOUT` |
| OpenAI cannot be reached (DNS, network, outage) | 502 | `PROVIDER_UNAVAILABLE` |
| OpenAI returns an error (500, 429 rate limit, 401 bad key) | 502 | `PROVIDER_ERROR` |
| OpenAI reply is empty, cut off or not JSON | 502 | `INVALID_PROVIDER_RESPONSE` |

`/health` and the catalogue endpoints do not call OpenAI, so they keep working
in every case. A failed AI call never fails a deploy either: the deploy smoke
test checks `/health` and the catalogue only, and the live AI check runs
separately (`ai-smoke.yml`, #78).

## 1. Local drill (any time, no key, no cost)

```powershell
npm run drill:ai --prefix backend
```

It starts the real API and provider client, points the client at a fake
OpenAI server on `127.0.0.1`, and makes that server fail in each way above
(plus a normal answer as a control). For each case it checks the status, the
error code, that the reply contains neither the key nor the fake provider's
internal error text, and that `/health` and `/api/document-types` still answer
200. Example output:

```text
| Scenario | Status | Error code | Result |
|---|---|---|---|
| Provider answers normally (control) | 200 | — | pass |
| No API key configured | 503 | MISSING_CREDENTIALS | pass |
| Provider is too slow (timeout) | 504 | PROVIDER_TIMEOUT | pass |
| Provider cannot be reached | 502 | PROVIDER_UNAVAILABLE | pass |
| Provider returns HTTP 500 | 502 | PROVIDER_ERROR | pass |
| Provider rate-limits us (HTTP 429) | 502 | PROVIDER_ERROR | pass |
| Provider reply is cut off | 502 | INVALID_PROVIDER_RESPONSE | pass |
| Provider reply is not JSON | 502 | INVALID_PROVIDER_RESPONSE | pass |
```

The same drill runs in CI as `backend/test/ai-failure-drill.test.js`, part of
the required `Install, lint, build, and test` check, so a change that breaks
failure handling cannot merge.

### Document analysis in CI (#32)

`backend/test/ai-failure-flow.test.js` covers the document analysis flow
(`POST /api/applications/:id/analyses`, #28). It runs the real route,
extractor (#27), provider code and database layer (PGlite), and replaces only
the OpenAI HTTP call. CI runs it in the step **Run mocked AI failure tests**,
inside the required check, with no API key. Any attempt to reach the real
network fails the test, so an OpenAI outage or spending limit can never break
CI.

| Provider behaviour | Analysis response | Stored row |
|---|---|---|
| Valid observations | 201, analysis returned | `completed`, requirement can become complete |
| Slower than the timeout | 504 `ANALYSIS_TIMEOUT` | `failed`, no result |
| HTTP 500, HTTP 429, or unreachable | 502 `ANALYSIS_PROVIDER_FAILURE` | `failed`, no result |
| Not JSON, empty, cut off, refusal, missing or unknown fields, wrong types, out-of-range confidence, unknown readability | 502 `INVALID_ANALYSIS` | `failed`, no result |
| Names or addresses that are not in the document | 201, invented values erased (`null`) | `completed` with `incomplete` outcome |
| Document text that gives the AI instructions | Sent only as the user message, after the system prompt that says to ignore it | Normal |

For every failure, the tests also check four things:

- Nothing is returned as a successful analysis.
- The checklist does not mark any requirement complete.
- The model, prompt version and schema version are still recorded.
- The document's name and address never appear in the response, the stored row, the checklist or the logs.

**Prompt and schema changes.** The same file records a SHA-256 fingerprint of
the extraction prompt and of `document-analysis.v1.schema.json` for each
version. If either changes without a version bump, CI fails and says to:

1. bump `EXTRACTION_PROMPT_VERSION` or `ANALYSIS_SCHEMA_VERSION`;
2. record the new fingerprint;
3. re-run the #31 evaluation set.

Stored results and evaluations then always say which prompt and schema
produced them.

## 2. Staging drill (for the demo or a consultation)

Run this on **staging only**, never production. It needs `AI_VERIFY_ENABLED=true`
on the staging backend (`tsek-api-staging` on Render), migration 005, and a
fresh staging Neon Auth session JWT in the local `AI_VERIFY_TOKEN` environment
variable. The deployed drill counts against that user's normal quota. Pause
until the `Retry-After` window expires if the quota returns HTTP 429. Each step
changes one environment variable on Render, which restarts
the service; wait until Render shows the deploy as live before running the
check.

Do the steps in this order, so each check fails for the reason it tests.
`<check>` stands for
`npm run drill:ai --prefix backend -- --url https://tsek-api-staging.onrender.com`.

1. **Record the current values.** Write down whether `OPENAI_TIMEOUT_MS` is
   set and to what. Check that `OPENAI_API_KEY` holds the real staging key
   ([`STAGING.md`](STAGING.md)); without a key, step 2 returns
   `MISSING_CREDENTIALS` instead of a timeout. Keep that key somewhere safe, or
   plan to create a new one in the `tsek-staging` OpenAI project at the end.
2. **Timeout.** Set `OPENAI_TIMEOUT_MS` to `1`. Run `<check> --expect PROVIDER_TIMEOUT`.
3. **Restore the timeout** to the value from step 1, or delete it if it was not
   set. Otherwise the next checks time out instead of testing the key.
4. **Bad key.** Change `OPENAI_API_KEY` to `sk-invalid-drill`. Run
   `<check> --expect PROVIDER_ERROR`.
5. **No key.** Delete `OPENAI_API_KEY`. Run `<check> --expect MISSING_CREDENTIALS`.
6. **Restore the real key.** Run `<check> --expect OK`, which passes only when
   the AI call returns a result again.

The command checks the status that goes with each code (504 for
`PROVIDER_TIMEOUT`, 502 for `PROVIDER_ERROR`, 503 for `MISSING_CREDENTIALS`,
200 with a result for `OK`), and that `/health` and `/api/document-types` still
return 200.

During the drill, open the staging site: the catalogue and requirements screens
must keep working. Record the drill in `docs/INCIDENTS.MD` as a planned drill
(not an incident), with the times and results.
