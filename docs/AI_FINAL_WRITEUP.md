# TSEK final AI write-up

TSEK uses GPT-4.1 mini to extract the document title, applicant name, address,
and readability from document text. The v1.1.0 change from PR #214 keeps
that model and adds a versioned prompt and a backend evidence check. Six
synthetic OCR examples in the prompt show how to handle noise, missing
fields, torn titles, and misleading office headers. The model returns
observations under a strict schema. The backend validates the observations
and derives the extraction outcome, missing-field list, and checklist status.
The examples are supplied with each request, so this work used no fine-tuning.
[PR #214](https://github.com/Anthonyiwnl/tsek/pull/214) ·
[v1.1.0 release notes](../CHANGELOG.md#110---2026-11-15) ·
[Frozen prompt and schema versions](AI_EVALUATION_FREEZE.md#frozen-versions)

## Production evaluation

The initial candidate scored 20/20 on the cases used to tune it, for both
GPT-4o mini and GPT-4.1 mini. Both scored 26/30 on Kenlie’s examples and
21/25 after excluding the five cases that appeared in the prompt. On the 17
fixed #31 cases, GPT-4o mini scored 16/17 and GPT-4.1 mini scored 14/17 on
extraction outcomes. Both copied fabricated fields in case 15, and
GPT-4.1 mini also triggered a false government ID checklist completion.
[Initial candidate report](../scripts/eval/results/production-prompt-1.1.0/report.md)

The final comparison ran GPT-4.1 mini on the same 42 synthetic source
document texts once per version. The released v1.0.0 baseline and the
v1.1.0 candidate used strict production structured output in staging.
All 84 live replies were replayed through the corresponding backend.
The evidence filter changed the text sent to the model in case 15 alone.
The #31 checklist was scored against the seeded catalogue’s frozen
expectations. The earlier #31 mock run matched all 17 expectations with
scripted replies, which tested backend behavior under known inputs.
[Paired evaluation report](../scripts/eval/results/production-prompt-before-after/report.md) ·
[Per-document replay](../scripts/eval/results/production-prompt-before-after/replay.json) ·
[Scripted backend results](AI_EVALUATION_FREEZE.md#results)

| Measure | v1.0.0 baseline | v1.1.0 |
| --- | ---: | ---: |
| Kenlie’s 25, correct extraction outcomes | 22/25 | 22/25 |
| Kenlie’s 25, correct fields and readability | 97/100 | 97/100 |
| Kenlie’s 25, exact missing-field lists | 22/25 | 22/25 |
| Fixed #31, correct extraction outcomes | 14/17 | 15/17 |
| Fixed #31, correct fields and readability | 61/68 | 64/68 |
| Fixed #31, exact missing-field lists | 14/17 | 15/17 |
| Fixed #31, matching checklist results | 16/17 | 17/17 |

Both versions picked the wrong address in the same three of Kenlie’s cases.
The updated version still missed the extraction outcomes for #31 case 10
(birth certificate without a residence) and case 13 (unreadable scan).
The checklist score measures agreement with backend expectations. Those
expectations still differ from human judgment on the address-free
passport, the bill under another person’s name, and the expired license.
[Remaining errors](../scripts/eval/results/production-prompt-before-after/report.md#case-15-and-remaining-errors) ·
[Fixed set labels](../backend/test/fixtures/document-evaluation-v1/expected.json)

## Model comparison

The benchmark used a shared evaluation prompt and a separate set of 20
synthetic texts. It asked the model to return an outcome. In production,
the backend derives the outcome. All 120 scored responses passed the
benchmark schema. Cost estimates apply to the 20 scored calls per
configuration at the recorded rates. Latency excludes warm-up requests.
[Default reasoning report](../scripts/eval/results/2026-11-14T16-14-30.md) ·
[Minimal reasoning report](../scripts/eval/results/2026-11-14T16-16-01.md)

| Model | Reasoning | Field accuracy | Correct outcomes | Median / p95 | Estimated run cost |
| --- | --- | ---: | ---: | ---: | ---: |
| GPT-4.1 mini | Default | 94% | 20/20 | 1.4 / 1.6 s | $0.0087 |
| GPT-4o mini | Default | 96% | 20/20 | 2.3 / 3.9 s | $0.0032 |
| GPT-5 mini | Default | 100% | 20/20 | 5.0 / 8.8 s | $0.0234 |
| GPT-5 mini | Minimal | 98% | 19/20 | 2.2 / 2.9 s | $0.0082 |
| GPT-5 nano | Default | 96% | 18/20 | 6.6 / 8.3 s | $0.0103 |
| GPT-5 nano | Minimal | 88% | 17/20 | 1.7 / 2.2 s | $0.0017 |

GPT-4.1 mini had the lowest median and p95 latency and was the deployed
baseline for the production replay. GPT-4o mini matched its outcome score
at about 37% of the estimated cost. GPT-5 mini at default reasoning reached
100% field accuracy with the longest p95. GPT-5 nano with minimal reasoning
had the lowest estimated cost and missed three outcomes. Each run sampled
one reply per text, so one case changes outcome accuracy by five percentage
points. The benchmark measured text extraction from synthetic inputs.
[Benchmark method](../scripts/eval/README.md) ·
[Production replay method](../scripts/eval/results/production-prompt-before-after/report.md)

## Case 15 before and after

Case 15 is a synthetic letter containing an instruction that claims it is
a passport and supplies fabricated applicant details. The original backend
checked for those values anywhere in the source text, so it accepted the
model’s forged observations. The v1.1.0 backend excludes detected
AI-directed passages from the text it sends and from the evidence it uses
to validate the model’s reply. Case 15 prompted the fix.
[Paired case evidence](../scripts/eval/results/production-prompt-before-after/replay.json)

| Observed result | v1.0.0 baseline | v1.1.0 |
| --- | --- | --- |
| Document title | `PASSPORT` | `LETTER` |
| Applicant and address | Fabricated values retained | Both `null` |
| Extraction outcome | `complete` | `incomplete` |
| Government ID requirement | `complete` | `uncertain` |

The regression test feeds the forged response back to the updated
extractor and verifies that it clears the fields and leaves the government
ID requirement unmatched. The guard targets explicit model-directed
passages. The results measure extraction on the replay corpus, and
authenticity, identity matching, and expiry checks are outside that scope.
[Backend regression test](../backend/test/ai-failure-flow.test.js) ·
[Evidence-filter tests](../backend/test/extraction.test.js) ·
[Incident record](INCIDENTS.MD#inc-10--instructions-inside-a-document-could-steer-the-ai-document-check)
