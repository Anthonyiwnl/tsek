# TSEK backend

The backend keeps the OpenAI connection server-side. The frontend must never
receive `OPENAI_API_KEY` or call the provider directly.

## Run locally

From the repository root:

```powershell
Copy-Item .env.example .env
cd backend
npm ci
npm test
npm start
```

Set `OPENAI_API_KEY` in the local environment before making a live request.
The documented default model is `gpt-4.1-mini`; `OPENAI_MODEL` may override it
for an explicitly approved deployment configuration.

## API

`GET /health` returns `{ "status": "ok" }` and does not require credentials.

`POST /api/verify` accepts a JSON body with a non-empty `input` string. The
backend sends that input to the configured provider and returns only the
sanitized model and result text:

```json
{
  "input": "Synthetic document text"
}
```

Failures use a stable `{ "error": { "code", "message" } }` shape. Missing
credentials, provider errors, unavailable providers, malformed responses, and
timeouts are handled without exposing provider payloads or secrets.
