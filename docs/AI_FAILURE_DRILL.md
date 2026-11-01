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

## 2. Staging drill (for the demo or a consultation)

Run this on **staging only**, never production. It needs `AI_VERIFY_ENABLED=true`
on the staging backend (`tsek-api-staging` on Render), which #42 requires
anyway. Each step changes one environment variable on Render, which restarts
the service; wait until Render shows the deploy as live before running the
check.

| Drill | Change on Render (staging) | Check | Expected |
|---|---|---|---|
| Timeout | Set `OPENAI_TIMEOUT_MS` to `1` | `npm run drill:ai --prefix backend -- --url https://tsek-api-staging.onrender.com --expect PROVIDER_TIMEOUT` | pass |
| Bad key | Change `OPENAI_API_KEY` to `sk-invalid-drill` (copy the real value somewhere safe first, or regenerate it in the `tsek-staging` OpenAI project afterwards) | same command with `--expect PROVIDER_ERROR` | pass |
| No key | Delete `OPENAI_API_KEY` | same command with `--expect MISSING_CREDENTIALS` | pass |

**Before you start,** write down whether `OPENAI_TIMEOUT_MS` is set on staging
and to what value.

**Undo** every change right after the drill: set `OPENAI_TIMEOUT_MS` back to the
value you wrote down, or delete it if it was not set before, and restore the
real key. Then confirm with `--expect OK`, which passes only when the AI call
returns a result again.

The command checks the status that goes with each code (504 for
`PROVIDER_TIMEOUT`, 502 for `PROVIDER_ERROR`, 503 for `MISSING_CREDENTIALS`,
200 with a result for `OK`), and that `/health` and `/api/document-types` still
return 200.

During the drill, open the staging site: the catalogue and requirements screens
must keep working. Record the drill in `docs/INCIDENTS.MD` as a planned drill
(not an incident), with the times and results.
