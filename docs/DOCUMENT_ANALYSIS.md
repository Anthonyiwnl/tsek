# Sprint 2 document analysis contract

Sprint 2 prepares the document-analysis contract. It does not upload files,
run OCR, call the AI provider for documents, or persist records. Those are
Sprint 3 concerns.

## Versioned schema

The versioned JSON Schema is
[`backend/schema/document-analysis.v1.schema.json`](../backend/schema/document-analysis.v1.schema.json).
The backend validator is implemented in
[`backend/src/analysis.js`](../backend/src/analysis.js), with fixtures under
`backend/test/fixtures/analysis/`.

Every analysis includes a `schemaVersion`, an `analysisId`, and a `source`
object containing both `applicationId` and `uploadedFileId`. This gives a
future persistence layer stable links from an application to the uploaded file
and from that file to its analysis records without requiring file upload in
Sprint 2.

## Observations versus decisions

`observations` records what was extracted from the document:

- `documentType`
- `applicantName`
- `address`
- `readability`

Text observations use a nullable `value` and a confidence score. A `null`
value means the extractor did not obtain that field; it is not itself a
business-rule decision.

`decisions` records backend business rules:

- `missingInformation` lists fields that are absent from the observations and
  explains why each is needed.
- `outcome` is derived from readability and missing information.

The validator rejects unknown fields, wrong observation types, missing
decision entries, conflicting missing-information decisions, and outcomes that
do not match the supplied observations. This keeps model/extraction output
separate from application policy.

## Fixture coverage

The test suite covers complete, incomplete, wrong-type, unreadable, and
malformed responses. Run it with:

```powershell
npm test --prefix backend
```

`POST /api/analyses/validate` requires a bearer token and accepts a JSON body
with a `response` property containing either the parsed analysis object or a raw
JSON response string. Validation results contain `valid` and `errors`. The
endpoint does not upload, persist, or process documents.

## Backend extraction

`createDocumentExtractor()` in `backend/src/extraction.js` accepts text already
obtained by the backend along with the trusted application and uploaded file IDs.
The versioned prompt and the observations schema guide the provider reply. The
backend checks the reply, clears unreadable or unsupported values, and derives
decisions from the validated observations. This module is called directly by
backend consumers.

Every result includes metadata with the provider, configured model, temperature,
timeout, prompt version, and schema version. Keep this metadata with evaluation
results for both successful and failed runs. Processing outcomes are `success`,
`timeout`, `provider_failure`, `malformed_output`, and `invalid_input`. Success
includes a validated analysis, whose business outcome may be `unreadable`.

Run the synthetic extraction tests with `node --test backend/test/extraction.test.js`.

## Synthetic backend evaluation (#31)

The [v1 fixture set](../backend/test/fixtures/extraction-eval.v1.json) records
expected field values, readability, decisions, missing fields, type matches,
and error codes independently of the scripted provider replies. Each success
must satisfy the analysis contract and retain the input source IDs. Invalid
input must be rejected before the provider is called. The wrong-type check
compares the detected title to the requested title in the fixture.

From the repository root with Node 24:

```powershell
node --test backend/test/extraction-eval.test.js
```

The test prints actual fields, decisions, and model configuration for every
case. It also runs as part of the standard backend suite. Update the pinned
dataset, prompt, or schema version when recording expectations for a new
contract. This evaluation uses the backend prompt and schema directly.

### Recorded mock run

All eight cases matched their expected checks. Dataset, prompt, and schema
were all version `1.0.0`. The configured model was `gpt-4.1-mini` with
temperature `0` and a `10000 ms` timeout. Provider replies were synthetic.

| Sample | Observed result |
| --- | --- |
| Valid clearance | `complete`, all three fields matched, requested type matched |
| Blank text | `INVALID_EXTRACTION_INPUT`, zero provider calls |
| Malformed provider JSON | `INVALID_PROVIDER_RESPONSE`, no analysis |
| Out-of-range confidence | `INVALID_PROVIDER_RESPONSE`, no analysis |
| Incomplete residency certificate | Unsupported address cleared to `null`, address listed as missing, `incomplete` |
| Wrong type | Detected Certificate of Residency, expected Barangay Clearance, type check failed although extraction was `complete` |
| Unreadable text | All three values cleared to `null`, `unreadable` |
| Partially readable text | All three fields matched, `needs_review` despite zero missing fields |

The run measures backend behavior under controlled provider replies. Live
model accuracy, confidence calibration, and OCR performance remain unmeasured.
The source-text check can discard a correctly inferred value if the OCR
spelling or punctuation differs. Text appearing verbatim in the source can
still be assigned to the wrong field, for example if a signer is selected as
the applicant. The eight-case run covers extraction and the fixture's type
comparison. The prepared document run below exercises the stored analyses and
checklist from #28.

### Prepared document samples and prewritten labels

The supplied pack contained 17 synthetic text files. The [samples](../backend/test/fixtures/document-evaluation-v1/samples)
and [prewritten expectations](../backend/test/fixtures/document-evaluation-v1/expected.json)
were copied into the repository before running the evaluation. The labels
record the expected fields and extraction decision, the predicted TSEK
checklist status, and the separate human judgment. The original eight cases
above also cover blank input, malformed JSON, and out-of-range confidence.

For an image or scanned PDF, use OCR to prepare a text sample. For a PDF with
a selectable text layer, extract that text directly. Record the expected
fields from the source first and compare the prepared text with the source
before interpreting extraction errors. Keep OCR or transcription errors
separate from field extraction and checklist errors. The supplied text files
stand in for that preparation step. The analysis API returns
`415 TEXT_EXTRACTION_UNAVAILABLE` for PDF and PNG uploads before calling the
extractor.

Run the supplied pack with Node 24 and the backend development dependencies:

```powershell
node --test --test-name-pattern="prepared document evaluation" backend/test/application-analyses.test.js
```

The mock provider replays the prewritten observations. Each case uploads the
text, runs the backend extractor, checks the stored result, and reads the
checklist for a fresh application. The test prints actual fields, checklist
status, and model metadata per sample.

### Recorded prepared document run

All 17 samples matched the expected extraction fields, decisions, and TSEK
checklist statuses. All 17 analysis results were persisted and read back.
Dataset, prompt, and schema were version `1.0.0`. The configured model was
`gpt-4.1-mini` with temperature `0` and a `10000 ms` timeout.

| Stage | Observed results |
| --- | --- |
| Extraction | 8 complete, 7 incomplete, 1 unreadable, 1 needs review |
| Checklist target | 6 complete, 4 incomplete, 7 uncertain |
| Unsupported source formats | PDF and PNG returned HTTP 415 with zero extractor calls |

Five checklist results differed from the prewritten human judgments.

| Samples | Observed rule limitation |
| --- | --- |
| 02 Passport | The missing address makes the checklist incomplete even though the ID is acceptable. |
| 06 PhilSys and 07 electric bill | The printed titles do not match the seeded accepted names, so both are uncertain. |
| 16 Bill under another name | Proof of residency is complete because the checklist does not compare applicant names. |
| 17 Expired license | The ID is complete because the checklist does not evaluate expiry. |

The mocked response for sample 15 represents the desired handling of
embedded instructions. Model resistance to that input, live field accuracy,
and OCR quality were outside this run. The full repository check passed with
180 backend tests and 12 frontend tests.
