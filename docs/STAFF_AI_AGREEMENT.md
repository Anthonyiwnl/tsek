# Staff requirement reviews

Depends on decision history (#345). Staff can explicitly review each requirement
on a submitted application before recording the overall application decision.
The server reads the current AI checklist itself; clients cannot supply its
status or prompt version. A disagreement requires a reason. Reviews are atomic,
append-only and limited to one per application/requirement to prevent repeated
clicks from inflating the metric. Citizens and self-reviewers cannot write them.

The signals summary shows twelve weeks of UTC agreement counts and ratios.
The denominator is explicitly reviewed requirements, not all applications;
unreviewed requirements do not imply agreement. Empty data gives no estimate.

From backend, run `node --import ./src/environment.js scripts/export-overrides.js`
to export label candidates to stdout. It exports neither documents, free-text
reasons, application/file IDs, nor account IDs. Do not automatically train on
this output: a reviewer must add separately authored synthetic/redacted input,
check the labels, and exclude held-out evaluation cases before promotion.
