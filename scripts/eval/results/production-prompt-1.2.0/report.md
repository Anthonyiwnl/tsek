# Paired production extraction replay for 1.2.0

On November 18, 2026, TSEK ran the same 42 synthetic documents once per
version using its capped staging evaluation key. Both extractors used
`gpt-4.1-mini-2025-04-14` via Chat Completions, temperature 0, a 1,000-token
output limit, a 10-second deadline, and strict `document_observations_v1`
output from schema `1.0.0`. All 84 requests succeeded.
[GitHub Actions run](https://github.com/Anthonyiwnl/tsek/actions/runs/44278887059)

| Version | Backend commit |
| --- | --- |
| 1.1.0 | `5516d7622f2e345890514f651d35db6c9e8ee3b9` |
| 1.2.0 | `72cdea273d46789149fba6e03b37df23604a83f9` |

The replay used the frozen references and scoring from the previous paired
evaluation. Kenlie’s 25 holdout cases exclude the five used as prompt
demonstrations. Title scoring normalizes case, whitespace, and Unicode.
Names and addresses use the benchmark’s word overlap and number matching.
For the fixed #31 set, the production checklist functions ran against the
seeded catalogue. [Previous paired evaluation](../production-prompt-before-after/report.md)

| Metric | 1.1.0 | 1.2.0 |
| --- | ---: | ---: |
| Kenlie’s 25, correct outcomes | 22/25 | 22/25 |
| Kenlie’s 25, correct fields including readability | 97/100 | 97/100 |
| Kenlie’s 25, exact missing-field lists | 22/25 | 22/25 |
| Fixed #31, correct outcomes | 15/17 | 15/17 |
| Fixed #31, correct fields including readability | 62/68 | 62/68 |
| Fixed #31, exact missing-field lists | 15/17 | 15/17 |
| Fixed #31, matching checklist results | 17/17 | 17/17 |

Every document earned the same scores on both prompts. In case 15, both
extractors filtered the model-directed paragraph before calling the provider.
Both returned a letter with no applicant or address, and the checklist left
the government ID requirement uncertain.

Both prompts missed the same three holdout outcomes due to address selection
and the same two #31 outcomes, the birth certificate and garbled scan.
The historical 1.1.0 replay scored 64/68 fields on #31. The fresh baseline
scored 62/68, which 1.2.0 matched. Each prompt received one live completion
per synthetic document. [Per-document replay and fingerprints](replay.json)
