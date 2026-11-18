# Observability

Observability means being able to tell what the live app is doing, and why,
from the data it records about itself (end-term deck, Module 7). TSEK records
three kinds of data, joined by one request ID:

| Record | What it answers | Where |
|---|---|---|
| **Logs** | What happened in this one request? | Render logs, one JSON line per event |
| **Traces** | Which step made the user wait? | The `spans` of each `http_request` log line |
| **Metrics** | Is the service healthy overall? | Hourly [uptime check](../.github/workflows/uptime.yml), [`SLO.md`](SLO.md) |

The request ID is the tracking number. The backend creates one for every
request and returns it in the `X-Request-Id` header. The same ID appears in
every log line for that request and in the body of a `500` error, so a user's
screenshot of an error leads straight to its log lines.

## Log lines

Every line is one JSON object with an `event` field. None contains SQL text,
document text, model replies, tokens, credentials or personal data.

| `event` | When | Key fields |
|---|---|---|
| `http_request` | Every request, when the response finishes or the client disconnects | `requestId`, `method`, `route` (the pattern, such as `/api/applications/:id`, never the real ID), `status`, `aborted`, `durationMs`, `spans` |
| `ai_call` | Every provider attempt | See [`AI_PROVIDER.md`](AI_PROVIDER.md#request-and-cost-controls) |
| `request_failed`, `readiness_check_failed`, `auth_verification_unavailable`, `ai_budget_unavailable` | Errors | `requestId`, error `type` and `code` |

## Traces

A trace is the `spans` list of one `http_request` line: each span is one step
of the request, with when it started (`startMs`, from the start of the
request) and how long it took (`durationMs`). A span opened inside another
records it as `parentId`. Names follow the OpenTelemetry semantic conventions
where one exists.

| Span | Step | Attributes |
|---|---|---|
| `db.connect` | Waiting for a pooled database connection | `db.system` |
| `db.query` | One SQL statement | `db.system`, `db.operation` (`SELECT`, `INSERT`, …) |
| `ai.extract` | The whole document extraction | — |
| `gen_ai.chat` | One OpenAI attempt, inside `ai.extract` or `/api/verify` | `gen_ai.system`, `gen_ai.request.model`, `attempt` |
| `ai.validate` | Checking the extraction against the contract and the request | — |

A failed span has `status: "error"` and the error's name in `errorType`. At
most 100 spans are kept per request; extra ones are counted in
`droppedSpans`.

Example: one document analysis (abridged; some `db.query` spans left out).

```json
{"event":"http_request","requestId":"6c1e…","method":"POST","route":"/api/applications/:id/analyses","status":201,"aborted":false,"durationMs":4612.4,
 "spans":[
  {"id":1,"parentId":null,"name":"db.query","startMs":2.1,"durationMs":38.7,"status":"ok","db.system":"postgresql","db.operation":"SELECT"},
  {"id":4,"parentId":null,"name":"ai.extract","startMs":161.0,"durationMs":4210.3,"status":"ok"},
  {"id":5,"parentId":4,"name":"gen_ai.chat","startMs":161.4,"durationMs":4205.8,"status":"ok","gen_ai.system":"openai","gen_ai.request.model":"gpt-4.1-mini","attempt":1},
  {"id":6,"parentId":null,"name":"ai.validate","startMs":4371.5,"durationMs":0.4,"status":"ok"},
  {"id":7,"parentId":null,"name":"db.query","startMs":4372.0,"durationMs":29.9,"status":"ok","db.system":"postgresql","db.operation":"WITH"}
 ]}
```

Read it as a waterfall: the model call is over 90 % of the request, so
tuning the database would be wasted effort.

## Finding a request

1. Take the request ID from the `X-Request-Id` response header (browser
   developer tools → Network) or from the error body.
2. In Render, open the service (`tsek-api-staging` or `tsek-api`) → **Logs**
   and search for the ID. The `http_request` line shows the route, status and
   spans; `ai_call` lines show each provider attempt.

The tracer is built in (`backend/src/tracing.js`, Node's
`AsyncLocalStorage`), so it needs no extra service or account. Because span
names follow the OpenTelemetry conventions, an OpenTelemetry exporter can
replace it later without renaming anything.
