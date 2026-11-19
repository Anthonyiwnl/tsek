# AI provider verification

## Configuration decision

The current repository documentation names OpenAI GPT-4.1 mini. This task
uses that configuration unchanged:

- Provider endpoint: OpenAI Chat Completions API
- Model: `gpt-4.1-mini`
- Credential: backend-only `OPENAI_API_KEY`
- Timeout: 10 seconds by default across the first attempt and any retry,
  configurable with `OPENAI_TIMEOUT_MS`
- AI switch: only the exact value `AI_VERIFY_ENABLED=true` turns on the two
  routes that call OpenAI. When it is unset or anything else, neither calls
  OpenAI, even when a provider key is configured:
  - `POST /api/verify` returns `404 NOT_FOUND` without parsing the body.
  - Document analysis, `POST /api/applications/:id/analyses` (#28), returns
    `503 ANALYSES_UNAVAILABLE`. Uploads, the analysis list and the checklist
    keep working.

Both AI routes require a valid Neon Auth bearer token. Before turning AI on
for an environment, apply migrations `003` to `005` to that environment's
database (`005_ai_request_budget.sql` holds the request counters) and confirm
`NEON_AUTH_BASE_URL` points to that environment's Auth branch. Verify the
controls on [staging](STAGING.md) first. The switch is read at server startup.

## Where AI is on

| Environment | Render service | `AI_VERIFY_ENABLED` |
|---|---|---|
| Staging | `tsek-api-staging` | `true` |
| Production | `tsek-api` | `true` |

Production AI was turned on in Sprint 4, after the request and cost controls
below were merged and migrations `003` to `005` were applied to the
production branch by hand (the pipeline does not run migrations; see
[`RUNBOOK.md`](RUNBOOK.md) §1).

To check an environment without signing in, send `POST /api/verify` with no
token. It returns `401 MISSING_BEARER_TOKEN` when AI is on and
`404 NOT_FOUND` when it is off. Production returned `401` on 15 Nov 2026.

To turn AI off in either environment, set `AI_VERIFY_ENABLED=false` on its
Render service. That is the kill switch: no deploy is needed, and uploads, the
checklist and the catalogue keep working ([`MAINTENANCE.md`](MAINTENANCE.md)).

## Request and cost controls

- Both routes draw from the same PostgreSQL counters. Each user can make up
  to 3 requests per UTC minute and 20 per UTC day. The environment can admit
  up to 60 requests per UTC hour across all users and both routes.
- The backend checks the quota after authentication and input validation.
  A denied request returns `429 AI_RATE_LIMITED` with `Retry-After` in
  seconds. If the quota store is unavailable, the API returns
  `503 AI_BUDGET_UNAVAILABLE` and skips the provider call.
- Before the quota is charged, a circuit breaker and a bulkhead
  (`backend/src/ai-guard.js`) can refuse the request for free:
  - **Circuit breaker:** after 3 provider failures in a row (timeout,
    unreachable, or an HTTP error from OpenAI), both AI routes return
    `503 AI_UNAVAILABLE` with `Retry-After` for 30 seconds without calling
    OpenAI. Then one trial request goes through: success closes the circuit,
    failure opens it for another 30 seconds. A malformed reply counts as the
    provider being up; a missing key changes nothing. Each change of state
    logs one `ai_circuit` line. The state is kept per server process, so a
    restart closes it.
  - **Bulkhead:** at most 4 AI calls run at once per server process. A fifth
    gets `503 AI_BUSY` with `Retry-After: 5`. AI calls hold no database
    connection while they wait for OpenAI, so CRUD routes keep their pool; the
    limit keeps a burst from piling up open requests to OpenAI and tripping
    its rate limit.
- The provider caps output at 1,000 tokens per attempt. It retries once with a
  short randomized delay on HTTP 429, any HTTP 5xx, or malformed JSON from
  the provider. Each admitted request counts once and can make at most two
  provider attempts, for up to 120 attempts from requests admitted in any
  UTC hour. Final failures return the existing readable error codes.
- Each provider attempt emits one JSON `ai_call` log with the request ID,
  prompt version, model, attempt number, HTTP status, token counts when
  available, latency, and result code. Logs omit documents, prompts, model
  replies, identity data, and credentials.

No provider or model change was approved from the documented proposal.

For the Sprint 2 document-analysis preparation task, the proposal to use
GPT-4.1 instead of the configured GPT-4.1 mini was reviewed and deferred.
Structured document processing is not part of this sprint, and no comparative
evaluation evidence justifies changing the current model. Revisit the choice
with representative document fixtures and quality/cost measurements before
Sprint 3 integration.

## Verification evidence

The backend test suite uses a synthetic input and a mocked provider transport.
This verifies the request shape, model selection, sanitized result, input
validation, missing-credential handling, and timeout handling without putting
an API key in source control or CI logs.
Tests also verify that the route stays disabled by default and that unsupported
body charsets/encodings return sanitized `415 UNSUPPORTED_MEDIA_TYPE` errors.

Run from `backend/`:

```powershell
npm test
```

The endpoint is intentionally backend-only. The frontend does not contain a
provider key and does not call OpenAI directly.

## Limitations

- The automated checks do not prove that a deployment has a valid live API key
  or network access to OpenAI.
- The current endpoint accepts text input only; callers must provide extracted
  document text.
- Provider output is returned as text for now and is not yet a structured
  requirements decision.
