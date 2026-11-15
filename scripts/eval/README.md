# Model comparison

`compare-models.mjs` sends the same prompt ([`prompt.v1.md`](prompt.v1.md)) and
the same 20 synthetic documents ([`dataset/documents.v1.json`](dataset/documents.v1.json))
to each model you list, then scores the replies (#101).

It needs only Node 20 or newer: no `npm install`.

## What it measures

| Column | Meaning |
|---|---|
| Valid JSON | The reply contained a JSON object we could parse |
| Matches schema | The object has every field, with allowed values, from the prompt |
| Field accuracy | documentType, applicantName, address and readability, averaged per case |
| Outcome accuracy | Correct `complete` / `incomplete` / `unreadable` / `needs_review` decision |
| Missing-field list | `missingInformation` lists exactly the missing fields |
| Median / p95 latency | Time per document. The first request to each model is an untimed warm-up, so a local model's load time is not counted |
| Tokens, cost | From the API's usage numbers and the price table in [`lib.mjs`](lib.mjs) |

Names and addresses match when they share at least 75% of their words after
lowercasing and removing titles and punctuation, and every number (house,
lot, purok) is the same. So `Mr. TEODORO SUMBINGCO` matches `Teodoro
Sumbingco`, but a different person or `Lot 13` instead of `Lot 12` does not. A
field the model leaves out never counts as a correct empty value.

The dataset has 10 complete documents (3 of them with noisy OCR), 4
incomplete ones, 3 unreadable ones and 3 of the wrong type (one of which is
also missing its address). Every person, address and official
in it is invented. The expected answers were written before any model ran, and
a test checks that they follow the decision rules in the prompt.

## Run it

### Cloud models (OpenAI)

Use the capped **staging** key, never the production one. In PowerShell:

```powershell
$env:OPENAI_API_KEY = Read-Host -MaskInput "Staging OpenAI key"
node scripts/eval/compare-models.mjs --models openai:gpt-4.1-mini,openai:gpt-4o-mini,openai:gpt-5-mini,openai:gpt-5-nano
```

Set `OPENAI_ORG_ID` and `OPENAI_PROJECT_ID` to explicitly route requests to
the staging organization and project when model access depends on that scope.

20 documents cost well under $0.05 per model. `gpt-5` models are reasoning
models: add `--reasoning minimal` to make them faster and cheaper, in a
separate run, because the other models reject that option.

OpenAI is retiring older models. Check
[the deprecations page](https://platform.openai.com/docs/deprecations) before
choosing one; a model that is no longer served shows up as request errors (`E`).

### Local models (Ollama)

1. Install Ollama from <https://ollama.com/download> and check it runs:
   `ollama --version`.
2. Pull the models. Check each tag on <https://ollama.com/library> first; sizes
   are approximate:

   | Model | Download | Notes |
   |---|---|---|
   | `qwen3.5:9b` | ~7 GB | Small, fast; fits on most GPUs |
   | `qwen3.5:27b` | ~17 GB | Stronger; runs on 64 GB RAM, faster with a 24 GB GPU |
   | `qwen3:30b` | ~19 GB | Mixture of experts: large but quick per token |
   | `gpt-oss:20b` | ~14 GB | OpenAI's open-weight model |

   ```powershell
   ollama pull qwen3.5:9b
   ollama pull gpt-oss:20b
   ```

3. Run the comparison. Qwen and gpt-oss "think" before answering; `--reasoning none`
   turns that off, which is much faster. Try both and record which one you used:

   ```powershell
   node scripts/eval/compare-models.mjs --models ollama:qwen3.5:9b,ollama:qwen3.5:27b,ollama:gpt-oss:20b --reasoning none
   ```

   If the first request times out while a large model loads, raise
   `--timeout-ms` (default 180000).

Any other server with an OpenAI-compatible `/v1/chat/completions` endpoint
(LM Studio, llama.cpp, vLLM) works too: set `COMPAT_BASE_URL`, for example
`http://localhost:1234/v1`, and use `compat:<model>`. Remote servers must use
HTTPS, so a key is never sent in plain text; plain HTTP works only for
`localhost`.

### Useful options

| Option | Use |
|---|---|
| `--limit 3` | Quick check on the first 3 documents |
| `--repeat 3` | Run each document 3 times to see how stable the answers are |
| `--price gpt-x=0.2/0.8` | Price per 1M input/output tokens for a model not in the table |
| `--min-valid-json 0.95 --min-outcome 0.8` | Exit with an error when a model scores below these |
| `--no-save` | Print the table only |

## Results

Each run prints a table and writes `results/<timestamp>.md` (table and every
wrong answer) and `results/<timestamp>.json` (every reply). Commit the ones you
want to keep as evidence for the AI write-up and the sprint record.

To compare fairly, keep the prompt and dataset the same across models. When
you change either one, save it as a new version (`prompt.v2.md`,
`documents.v2.json`) and pass `--prompt` or `--dataset`, so older results stay
comparable.

## Tests

```powershell
node --test scripts/eval/compare-models.test.mjs
```

The tests use mock models and a fake local server, so they need no key or
network. The `Evaluation harness` workflow runs them, plus a mock comparison,
on every pull request that changes this folder. When such a change reaches
`main`, and the `OPENAI_EVAL_API_KEY` secret is set, it also evaluates the
prompt against `gpt-4.1-mini` and fails below 95% valid JSON or 70% outcome
accuracy. That step never runs on a pull request, so unmerged code never sees
the key. It can also be started by hand from the Actions tab, on `main`, with
another model.

## Limits

- Text only. The dataset is OCR text, not images. Reading photos directly
  (for example with `qwen3-vl`) needs an image dataset first.
- This is not the backend's production prompt. When structured extraction
  (#27) lands, point `--prompt` at its prompt so the comparison tests what we
  ship.
- 20 documents give a rough ranking, not a precise score: one wrong answer moves
  a rate by 5 points.
