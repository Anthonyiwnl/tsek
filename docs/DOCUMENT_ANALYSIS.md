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
