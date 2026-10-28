# AI provider verification

## Configuration decision

The current repository documentation names OpenAI GPT-4.1 mini. This task
uses that configuration unchanged:

- Provider endpoint: OpenAI Chat Completions API
- Model: `gpt-4.1-mini`
- Credential: backend-only `OPENAI_API_KEY`
- Timeout: 10 seconds by default, configurable with `OPENAI_TIMEOUT_MS`

No provider or model change was approved from the documented proposal.

## Verification evidence

The backend test suite uses a synthetic input and a mocked provider transport.
This verifies the request shape, model selection, sanitized result, input
validation, missing-credential handling, and timeout handling without putting
an API key in source control or CI logs.

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
