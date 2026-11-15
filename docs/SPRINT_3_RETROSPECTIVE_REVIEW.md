# Sprint 3 written retrospective from repository evidence

Prepared **8 November 2026 (PHT)** for [#33](https://github.com/Anthonyiwnl/tsek/issues/33).
Planned Sprint 3: **26 October–1 November 2026**.

The user requested a written retrospective because meeting records are unavailable.
This is a current review of repository records, **not meeting minutes or standup
attendance evidence**. No historical discussion, attendance, consensus or team
approval is asserted. Instructor/reviewer acceptance as a substitute remains pending.

## Delivered work and evidence

| Work | Source | What the source supports |
|---|---|---|
| Saved extraction results and checklist rules | [Merged #154](https://github.com/Anthonyiwnl/tsek/pull/154) | Backend implementation and deterministic verification |
| Synthetic evaluation | [Merged #155 / issue #31](https://github.com/Anthonyiwnl/tsek/pull/155) | Prewritten expected outcomes and recorded checklist limitations |
| Mocked provider-failure checks | [Merged #156 / issue #32](https://github.com/Anthonyiwnl/tsek/pull/156) | Deterministic CI independent of paid API availability |
| Versioned replacement/reanalysis | [Open #172 / issue #30](https://github.com/Anthonyiwnl/tsek/pull/172) | Tested implementation awaiting reviewed deployment |
| Existing deployed baseline | [Pipeline](https://github.com/Anthonyiwnl/tsek/actions/runs/42387515057) | Successful checks and staging/production backend release of `dc0feda` |
| Current controlled-test audit | [Consultation 3 record](CONSULTATION_3_EVIDENCE.md) | One successful real staging AI baseline and eight local failure/control cases |

Implementation and audit evidence includes work delivered after the planned sprint
dates. PR timestamps are delivery evidence, not proof that a meeting happened.

## What worked

- Mocked failure tests cover timeout, provider and malformed-output paths without
  depending on a paid provider to keep normal CI running.
- The evaluation records known shortcomings rather than treating deterministic
  success as a guarantee that every real document will be assessed correctly.
- Replacement work uses file revisions and analysis generations to prevent a late
  old response from restoring an obsolete checklist result.
- The deployment pipeline checks staging before production and reports release IDs.

## Gaps found

- #30 is not deployed while #172 remains unmerged. An old deployed baseline cannot
  serve as evidence for the replacement implementation.
- A successful `/api/verify` call is narrower than upload, structured extraction,
  persisted analysis, checklist refresh and UI display. The latter still needs
  one authenticated staging demonstration.
- Local simulated provider failure is not the same evidence as safe failure and
  recovery on a deployed staging service.
- Evaluation shows title matching, applicant-name and expiry limitations. Human
  review remains necessary; #30 does not correct those separate rule gaps.
- Separate service names do not prove distinct OpenAI keys/projects or budgets.
  The owner must verify the actual environment bindings without exposing secrets.
- Historical standup records and an actual demo recording were not supplied.

## Proposed next actions — for team acknowledgment

These assignments follow the issue owners and are proposals, not claimed agreements.

| Suggested owner | Action | Completion signal |
|---|---|---|
| Francis and a teammate reviewer | Complete #172 review, migration and normal release | Reviewed PR, migration outcome and successful deployment run linked |
| Francis, Axel and Anthony | Agree a current non-production smoke-test window | Actual dated acknowledgment and responsibilities recorded |
| Francis with Axel | Run synthetic UI upload/replacement and compare actual fields/checklist with expectations | Sanitized IDs, persistence checks and demo link |
| Anthony with Francis | Run a timeout-only staging drill and restore the original setting | Failed response, healthy non-AI routes and successful recovery recorded |
| Environment owner | Confirm distinct restricted staging/production keys and capped staging project | Non-secret owner attestation, not copied key values |
| Team / reviewer | Review this retrospective and accept or replace the missing-standup alternative | Actual review decision linked |

## Carry-forward decision

Keep #33 open until its live and process evidence is supplied or its acceptance
criteria are explicitly revised by the responsible reviewer. This written review
is useful process evidence, but it cannot create historical standups or deployment
results that were not observed.
