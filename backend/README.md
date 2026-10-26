# TSEK backend

The backend keeps the OpenAI connection server-side. The frontend must never
receive `OPENAI_API_KEY` or call the provider directly.

## Run locally

From the repository root:

`Copy-Item` creates a reference `.env` file only. `loadConfig()` reads
`process.env`; the backend does not load `.env` automatically. Set
`OPENAI_API_KEY` in the same shell before running `npm start`:

```powershell
Copy-Item .env.example .env
cd backend
npm ci
npm test
$env:OPENAI_API_KEY = "your-openai-api-key"
npm start
```

For Bash or Zsh, use `export OPENAI_API_KEY="your-openai-api-key"` before
`npm start` instead of the PowerShell assignment above.
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
