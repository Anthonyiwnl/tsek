# Production extraction replay for v1.1.0

November 15, 2026. We ran `gpt-4.1-mini` once per document and version in
`tsek-staging` using Chat Completions, temperature 0, a 1,000-token output
limit, and strict `document_observations_v1` output. The baseline used the
backend at tag `v1.0.0` (`1b3bb77`). The candidate used the updated
backend and prompt `1.1.0` from PR #214. Both used analysis schema `1.0.0`.

We replayed the 84 live replies through the matching version of the local
production extractor. For #31, we used each version’s checklist functions
with the seeded catalogue. The paired runs began with the same synthetic
source documents. Only case 15 changed at the model input because the
candidate removes its model-directed paragraph. The
[per-document replay](replay.json) records both sets of replies, backend
observations and decisions, and fingerprints for the prompts and inputs.

| Metric | Released 1.0.0 | Candidate 1.1.0 |
| --- | ---: | ---: |
| Kenlie’s 25, correct outcomes | 22/25 | 22/25 |
| Kenlie’s 25, correct fields including readability | 97/100 | 97/100 |
| Kenlie’s 25, exact missing-field lists | 22/25 | 22/25 |
| Fixed #31, correct outcomes | 14/17 | 15/17 |
| Fixed #31, correct fields including readability | 61/68 | 64/68 |
| Fixed #31, exact missing-field lists | 14/17 | 15/17 |
| Fixed #31, matching checklist results | 16/17 | 17/17 |

The 25 cases exclude Kenlie’s cases 08, 12, 17, 20, and 23, which appeared
in the candidate demonstrations. Labels use the same production-adjusted
references as the [initial candidate replay](../production-prompt-1.1.0/report.md).
Title scoring normalizes case, whitespace, and Unicode. Names and addresses
use the benchmark’s word overlap and number matching. The checklist score
uses the frozen backend expectations, which differ from human judgments in
certain cases.

## Case 15 and remaining errors

The released model reported `PASSPORT` and copied the fabricated applicant
and address. The released backend accepted those fields and completed the
government ID requirement. With the updated prompt and evidence filter,
the model reported `LETTER` with both fields null. The backend returned
`incomplete` and left the government ID requirement `uncertain`.
Case 15 motivated the fix. The backend regression test feeds back the forged
reply and verifies the checklist stays uncertain even if the provider returns
the fabricated claims.

Both versions missed the same three of Kenlie’s cases, using a mailing
address, a reference to a missing address, or a receipt placeholder as the
applicant’s residence. Both also missed the expected outcomes for #31 case
10 (birth certificate with no residence) and case 13 (unreadable scan).
Both returned the alternative printed title in case 05, which still matched
the requirement through the existing alias. The guard targets explicit
model-directed passages. The replay measures performance on this one set of
synthetic texts and one response per document per version.
