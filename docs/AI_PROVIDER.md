# AI provider verification

## Configuration decision

The current repository documentation names OpenAI GPT-4.1 mini. This task
uses that configuration unchanged:

- Provider endpoint: OpenAI Chat Completions API
- Model: `gpt-4.1-mini`
- Credential: backend-only `OPENAI_API_KEY`
- Timeout: 10 seconds by default, configurable with `OPENAI_TIMEOUT_MS`
- AI switch: only the exact value `AI_VERIFY_ENABLED=true` turns on the two
  routes that call OpenAI. When it is unset or anything else, neither calls
  OpenAI, even when a provider key is configured:
  - `POST /api/verify` returns `404 NOT_FOUND` without parsing the body.
  - Document analysis, `POST /api/applications/:id/analyses` (#28), returns
    `503 ANALYSES_UNAVAILABLE`. Uploads, the analysis list and the checklist
    keep working.

Set `AI_VERIFY_ENABLED=true` on the staging backend only, then restart/redeploy
that backend. Leave it unset or `false` in production. The switch is read when
the application starts. `/api/verify` has no authentication, and neither route
has a rate limit. Document analysis requires sign-in, but every call is a paid
OpenAI request. Rate limiting (#34) must exist before AI is enabled in
production.

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
- Document upload, OCR, database-backed requirements, authentication, and
  production deployment remain outside this task.
- The current endpoint accepts text input only; callers must provide extracted
  document text.
- Provider output is returned as text for now and is not yet a structured
  requirements decision.
