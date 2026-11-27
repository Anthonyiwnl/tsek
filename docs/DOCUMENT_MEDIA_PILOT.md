# Photo and PDF checks (post-freeze draft)

The feature is off unless DOCUMENT_MEDIA_ENABLED=true on the backend and
VITE_DOCUMENT_MEDIA_ENABLED=true on its matching frontend. Text processing and
the frozen 1.2.0 text prompt remain unchanged. Do not enable production yet.

The proposed pilot limits retain the existing 2 MiB/file and 10 files/application
caps, with at most 4 megapixels/image (maximum side 4096) or 3 unencrypted PDF
pages. DevOps must approve these limits. Content is parsed, not trusted by name:
PNG CRC/decoding, bounded JPEG decoding, and PDF structure/page counting. Parsing
runs in isolated workers with a 64 MiB JavaScript heap limit, a 2.5-second timeout,
and two concurrent slots. Native/ArrayBuffer memory also needs a staging RSS
benchmark before activation. Parser diagnostics are discarded. Both
upload and analysis validate, including files saved before the pilot.

Validated bytes are sent inline through the existing provider, strict observation
schema and deterministic decision validator. The request follows the existing
authentication, owner checks, AI admission, budget, circuit breaker, retry,
timeout, max_tokens and cost logging path. No external document URLs or provider
file uploads are used. The vision prompt version is 1.2.0-vision.1.

Visual values cannot be independently matched to source text. Their evidence-hit
metric is null, not a claimed successful match. Metadata and the UI require
staff review for every visual result, even when all requirement checks pass.
The existing text grounding check is retained.

## Evaluation gate before enabling

Synthetic PNG, JPEG, scanned-PDF and unreadable-image cases are in
scripts/eval/dataset/documents.media.v1.json. The frozen text evaluation set is
unchanged. Mocked tests check parsing, transport, schema, storage and budgets;
they are not model-accuracy evidence. No live AI call has been made for this PR.

Axel must review the labels, add realistic rotated/blurred phone-photo cases,
run the existing text benchmark at or above its recorded baseline, and run
`node --import ./src/environment.js scripts/eval-document-media.js --live`
from backend with a separately capped evaluation key. Commit both reports and
review cost/latency with DevOps before activating this pilot. Never use real IDs
or private documents in evaluation.

Provider contracts: [images](https://developers.openai.com/api/docs/guides/images-vision),
[PDF file inputs](https://developers.openai.com/api/docs/guides/file-inputs).
