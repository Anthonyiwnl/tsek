# Initial production extraction prompt 1.1.0 evaluation

November 15, 2026. GPT-4o mini and GPT-4.1 mini each processed 67 synthetic
documents once in the `tsek-staging` Playground. Both used Chat Completions,
temperature 0, a 1,000-token output limit, and strict
`document_observations_v1` structured output. This run used the initial
candidate prompt with SHA-256
`68cbda612ead452931c774957b86596cda11b4e317c5a790b379a941aac51123`.
The live replies were replayed locally through the production extractor.
For #31, the replay also used the real checklist functions with the seeded
catalogue. [Per-document evidence](replay.json)

| Evaluation set | GPT-4o mini outcomes | GPT-4.1 mini outcomes | GPT-4o mini fields | GPT-4.1 mini fields |
| --- | ---: | ---: | ---: | ---: |
| Original tuning set | 20/20 | 20/20 | 80/80 | 80/80 |
| Kenlie’s complete set | 26/30 | 26/30 | 112/120 | 116/120 |
| Kenlie cases outside the demonstrations | 21/25 | 21/25 | 92/100 | 96/100 |
| Fixed #31 set | 16/17 | 14/17 | 64/68 | 59/68 |

All 134 replies passed the production schema and extractor. Exact
missing-field lists scored 20/20, 25/30, and 15/17 with GPT-4o mini, and
20/20, 26/30, and 14/17 with GPT-4.1 mini. The #31 checklist matched its
reference in 17/17 cases with GPT-4o mini and 16/17 with GPT-4.1 mini.

The 20 cases guided prompt iteration. Kenlie’s cases 08, 12, 17, 20, and
23 appeared as demonstrations. The 25-case subset excludes those five.
No #31 case appeared as a demonstration. Reference outcomes for the
first two sets use the production decision rules with the reference
observations. #31 uses its frozen labels and checklist expectations.
Field scoring uses the printed title and the benchmark’s name and
address normalization. Both models returned the alternative printed
title for the cedula in #31 case 05. It missed the frozen title label
and still matched the checklist through the existing alias.

## Release findings

- Both models copied the fabricated applicant and address from the
  instruction embedded in #31 case 15. The backend’s source-text check
  retained those values. GPT-4.1 mini also reported the forged document
  type, and the checklist incorrectly marked the government ID
  requirement complete.
- GPT-4.1 mini also missed the outcomes for the birth certificate and
  garbled scan in #31 cases 10 and 13.
- On Kenlie’s unused cases, GPT-4o mini sometimes copied a third-party
  address. GPT-4.1 mini sometimes returned a missing-address placeholder
  as a value. All original tuning cases still passed, including the
  missing-address letter.

The initial candidate stayed out of the v1.0.0 tag. The automated suite
passed with scripted provider responses, including all 17 #31 cases.
The [paired evaluation](../production-prompt-before-after/report.md)
records the released baseline and the fix for case 15.
