# Sprint 4 document analysis evaluation

The November 13, 2026 replay for #36 used all 17 synthetic samples from #31
and the backend from commit `8687936`, which includes the request controls
from #34 and the PhilSys title fix from #157. The local run sent the actual
extraction request to a mock provider that returned prewritten observations.
It then exercised the real extractor, HTTP routes, persistence, and checklist.
These results measure backend behavior with fixed observations. Live model
accuracy, latency, token usage, and resistance to embedded instructions still
need a run against OpenAI.

## Frozen versions

| Component | Version or setting |
| --- | --- |
| [Production extraction prompt](../backend/src/extraction-prompt.v1.js) | `1.0.0` |
| [Document analysis schema](../backend/schema/document-analysis.v1.schema.json) | `1.0.0`. The provider receives the observations subschema as strict `document_observations_v1`. |
| [Fixed evaluation set](../backend/test/fixtures/document-evaluation-v1/expected.json) | `1.0.0`, with the PhilSys checklist expectation already updated by #157 |
| Model configuration in the replay | OpenAI Chat Completions with `gpt-4.1-mini-2025-04-14`, temperature `0`, `1000` maximum output tokens per attempt, and a `10000 ms` deadline shared by up to two attempts |

The prompt and schema contents retain their existing SHA-256 fingerprints in
the [failure flow tests](../backend/test/ai-failure-flow.test.js). The observed
checklist gaps arise in backend rules, so the replay gives no reason to revise
the prompt. Version and rerun both evaluation and failure checks before changing
the prompt or schema. The snapshot in this record pins the evaluation. The
deployed model is selected through `OPENAI_MODEL`. OpenAI lists January 14,
2027 as the snapshot's shutdown date. [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations)

## Results

All 17 cases matched the prewritten extraction fields, missing-field lists,
outcomes, and expected checklist results. All 17 analysis records were saved
and read back. Extraction produced 8 complete, 7 incomplete, 1 unreadable,
and 1 needs review. The target checklist result was complete in 7 cases,
incomplete in 4, and uncertain in 6. Checklist expectations describe current
backend behavior. The human judgments in the fixed set describe whether the
sample ought to satisfy the requirement.

| Sample | Observed result and limitation |
| --- | --- |
| 02 Passport | Missed acceptance. The absent address makes the ID incomplete even though the human judgment accepts the passport as ID. |
| 06 PhilSys | The printed title now completes the government ID requirement. |
| 07 Electric bill | Missed match. The extracted title `STATEMENT OF ACCOUNT` leaves proof of residency uncertain because it does not match a catalogue label. |
| 08 Grocery receipt, 09 school ID, 10 birth certificate | No requirement matched, as expected for these wrong types. |
| 11 Bill without address, 12 license with illegible name | The expected field was missing and the matching requirement remained incomplete. |
| 13 Garbled text | All three text observations were missing. The analysis was unreadable and the checklist remained uncertain. |
| 14 Partially readable bill | The analysis required review and proof of residency remained incomplete. |
| 15 Embedded instructions | The fixture remained unmatched. The mock supplied the expected observation, so this case verifies how the backend sends and handles the text. |
| 16 Bill under another name | Incorrect completion. The checklist does not compare the name on the bill with the applicant's identity. |
| 17 Expired license | Incorrect completion. The checklist does not check expiry. |

The four differences from human judgment are 02, 07, 16, and 17. The set is
small and text-only. It does not cover OCR quality, document authenticity, or
population-level error rates. The assertions for all 17 cases are in the
[prepared evaluation test](../backend/test/application-analyses.test.js).

## Estimated usage cost

The mock run made zero billed calls. As an estimate for one live pass, count
the characters in the system prompt, sample text, and serialized structured
output schema for each request. Count the characters in the serialized fixture
observations for each reply. Dividing by four and rounding up per request and
reply gives about 7,412 input tokens and 1,039 output tokens across 17 calls.
At US$0.40 per million uncached input tokens and US$1.60 per million output
tokens, that is **about US$0.0046 for the set**. This estimate excludes request
framing, caching, and retries. Actual token counts depend on tokenization and
the model's replies. Use the provider's usage metadata for a billed run.
[OpenAI GPT-4.1 mini pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini)

## Validation and privacy

- Analysis requires an authenticated owner, a draft application, and a linked
  plain-text file with 1 to 10,000 characters. The shared AI budget admits up to
  3 requests per user per UTC minute, 20 per user per UTC day, and 60 across
  all users per UTC hour. Rejected requests skip the provider call.
- The extractor treats uploaded text as data, checks the structured reply's
  fields and confidence, and clears values absent from the source. The backend
  derives decisions, checks the full schema and source IDs, and matches types
  against the catalogue. This verifies structure and source support. It cannot
  establish authenticity or whether a copied field belongs to the applicant.
- OpenAI receives the prepared text and extraction instructions. Real text can
  contain names and addresses. TSEK retains the original upload and validated
  analysis under the owner's application. File or application deletion cascades
  to its analysis rows. Owner-scoped analysis responses use `private, no-store`.
  The local evaluation uses synthetic fixtures and an in-memory database.
- Provider logs record request IDs, model, prompt version, attempt, status,
  timing, and token counts. They omit source text, credentials, and model reply
  bodies. Failed analyses store a stable error code and operational metadata
  with null result fields. The separate authenticated contract endpoint returns
  validation status and errors without returning the submitted analysis object.

## Reproduce the evaluation and demo

Run from the repository root with Node 24 and the locked dependencies:

```powershell
npm run setup
node --test --test-name-pattern="prepared document evaluation" backend/test/application-analyses.test.js
node --test backend/test/ai-failure-flow.test.js
npm run drill:ai --prefix backend
```

The replay and demos need no credentials or external network. The application
failure test passed all 19 checks, including 14 failure scenarios. A timeout
returned `504 ANALYSIS_TIMEOUT`. A provider outage returned
`502 ANALYSIS_PROVIDER_FAILURE`, and an invalid reply returned
`502 INVALID_ANALYSIS`. In each case the stored analysis had no result, the
checklist stayed incomplete, and synthetic personal data stayed out of the
failure response, result row, checklist, and logs. The standalone drill passed
all eight scenarios, including its healthy control, and verified that `/health`
and the catalogue still served requests. The full `npm run check` passed with
220 backend and 68 frontend tests. [AI failure drill](AI_FAILURE_DRILL.md)
