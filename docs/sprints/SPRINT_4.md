# Sprint 4 record: 2–8 November 2026

Goal from the course plan: finish the seven requirements, harden the deployed
application, measure pipeline improvements, complete technical and process
documentation, test rollback, and publish a tagged release.

This record separates the Sprint 4 cutoff (8 Nov) from work completed later.
It uses repository history, GitHub issues and pull requests, CI/CD records, and
the linked course plan. Sprint 4 issues were created on 20 Oct, before the
sprint; their creation dates are not presented as work completed during the
sprint. Where the evidence is incomplete, that is stated rather than inferred.

Sprint weeks run Monday to Sunday, Philippine time (UTC+8).

## What happened during the sprint (2–8 Nov)

| Date (PHT) | What | Evidence |
|---|---|---|
| 4–5 Nov | The staging Render deploy hook returned HTTP 500. The staging gate stopped the release before production. After staging was corrected, the 5 Nov rerun passed; a separate check confirmed both services' deployed commits. The hook itself was still unverified at the 8 Nov cutoff. | [INC-08](../INCIDENTS.MD#inc-08--staging-render-deploy-hook-returned-http-500), [failed run 41854655436](https://github.com/Anthonyiwnl/tsek/actions/runs/41854655436) |
| 6 Nov | Merged service-aware deploy planning. Required checks, the staging-before-production gate, and smoke tests stayed in place. | [PR #151](https://github.com/Anthonyiwnl/tsek/pull/151), [follow-up PR #167](https://github.com/Anthonyiwnl/tsek/pull/167) |
| 6 Nov | Opened the real Neon Auth verifier test follow-up after reviewers found gaps in test coverage. | [Issue #141](https://github.com/Anthonyiwnl/tsek/issues/141) |
| 7 Nov | Merged mocked AI failure-path tests into CI. The pull request reports 100/100 tests across the seven AI test files and 172/172 backend tests. | [PR #156](https://github.com/Anthonyiwnl/tsek/pull/156) |
| 8 Nov | Merged the pipeline results record, closing #37. Its Actions API snapshot runs from 2 Nov through 8 Nov at 09:14 PHT, not through the full sprint end. | [PR #168](https://github.com/Anthonyiwnl/tsek/pull/168), [pipeline metrics](../PIPELINE_METRICS.MD), [optimization log](../OPTIMIZATION_LOG.MD) |

## Planned, delivered and carried over

Status below reflects the issue tracker on 15 Nov 2026. A closed issue is not
treated as live-verified where its linked record says deployment evidence is
still pending.

| Issue | Plan | Owner | Status | When it was delivered, or why it slipped |
|---|---|---|---|---|
| [#34](https://github.com/Anthonyiwnl/tsek/issues/34) | Harden backend access, inputs and failure handling | Ken John Maghari | Closed after the sprint; live verification pending | [PR #184](https://github.com/Anthonyiwnl/tsek/pull/184) merged on 13 Nov. It adds AI authentication, shared quotas, bounded retries and attempt logs; the PR reports 218 backend and 46 frontend tests passed. Migration 005 must be applied before staging deployment, and live verification remains pending. |
| [#35](https://github.com/Anthonyiwnl/tsek/issues/35) | Verify the desktop and mobile application journey | Hero Pedero | Open | The issue remains open; its acceptance and completion evidence are not recorded there. |
| [#36](https://github.com/Anthonyiwnl/tsek/issues/36) | Finalize AI evaluation and freeze prompt versions | Axel Josh Lorayna | Closed after the sprint on 15 Nov | [PR #186](https://github.com/Anthonyiwnl/tsek/pull/186) merged the [frozen evaluation record](../AI_EVALUATION_FREEZE.md) and the first committed cloud benchmark results, a [`gpt-4.1-mini` baseline](../../scripts/eval/results/2026-11-14T15-58-13.md). Comparison results for the other models are pending. |
| [#37](https://github.com/Anthonyiwnl/tsek/issues/37) | Measure and improve pipeline performance | Anthony Saltat | Closed 8 Nov | [PR #168](https://github.com/Anthonyiwnl/tsek/pull/168) recorded the Actions measurements, optimization comparisons and remaining bottlenecks. The metrics snapshot ends at 09:14 PHT on 8 Nov, so it is not a full-day measurement. |
| [#38](https://github.com/Anthonyiwnl/tsek/issues/38) | Test deployment rollback and finish delivery documentation | Anthony Saltat | Closed after the sprint on 14 Nov | The drill ran on 14 Nov. Staging stopped the bad release, production was unaffected, and the pipeline recovered in 11 minutes. [PR #169](https://github.com/Anthonyiwnl/tsek/pull/169), [rollback record](../ROLLBACK_DRILL.md), and [INC-09](../INCIDENTS.MD#inc-09--planned-rollback-drill-staging-backend-fails-to-start). |
| [#39](https://github.com/Anthonyiwnl/tsek/issues/39) | Finish setup, API, database and architecture documentation | Francis Cromwell Tan | Open | The issue remains open; its acceptance and completion evidence are not recorded there. |
| [#40](https://github.com/Anthonyiwnl/tsek/issues/40) | Run final acceptance and rehearse the demonstration | Francis Cromwell Tan | Open | The issue remains open; its final acceptance, rehearsal and process-evidence checkboxes are unchecked. This issue also calls for the sprint plans, retrospectives and available standups. |
| [#41](https://github.com/Anthonyiwnl/tsek/issues/41) | Publish and verify the tagged production release | Anthony Saltat | Open | No completed release evidence or `v1.0.0` tag is recorded in the repository snapshot. |

At the 8 Nov cutoff, #37 was the only original Sprint 4 issue closed. #34
closed on 13 Nov with staging migration and live verification still pending.
#38 closed on 14 Nov, and #36 closed on 15 Nov. Four original Sprint 4 issues
remain open.

## Pipeline results

The recorded Sprint 4 snapshot covers 2 Nov 00:00 through 8 Nov 09:14 PHT:

| Measure | Recorded result | Evidence and limit |
|---|---|---|
| Pull request checks | 137/137 passed; median 17 s, p90 29 s | [Pipeline metrics](../PIPELINE_METRICS.MD). Snapshot is incomplete for 8 Nov after 09:14. |
| Main pipeline | 51/52 first attempts passed; median 137 s | Same snapshot; 50 runs with measured duration. |
| Production deployments | 47 runs with at least one production host rebuilt, plus 3 docs-only runs that passed smoke tests without rebuilding | Same snapshot and its counting rule. |
| Merge to verified production | Median 144 s across 47 deployments; 83 s when nothing needed rebuilding (3 runs) | Same snapshot. |
| Failed deploy and recovery | One staging failure (INC-08); 1063 min to the passing rerun; no production impact | [Run 41854655436](https://github.com/Anthonyiwnl/tsek/actions/runs/41854655436), [INC-08](../INCIDENTS.MD#inc-08--staging-render-deploy-hook-returned-http-500). |

Optimization evidence:

- The 3-second smoke-test polling change in [PR #116](https://github.com/Anthonyiwnl/tsek/pull/116) worked, but the comparison found no measurable whole-pipeline improvement; host build variation was larger than the expected saving. It was kept because the extra requests cost little.
- Service-aware deployment planning in [PR #151](https://github.com/Anthonyiwnl/tsek/pull/151) reduced the median for merges changing neither service folder from 161 s to 84 s (48%) across the measured before/after groups. Required checks and deployment gates remained enabled. The [optimization log](../OPTIMIZATION_LOG.MD) records the method and run links.

These figures are the recorded 09:14 snapshot. The repository does not contain
the promised end-of-day 8 Nov recalculation, so the Sprint 4 totals should not
be read as full-week totals.

## Post-sprint work and carryover

- [PR #184](https://github.com/Anthonyiwnl/tsek/pull/184) delivered the #34 code on 13 Nov. Apply migration 005 to staging and verify the affected live behavior before treating its completion evidence as finished.
- [PR #191](https://github.com/Anthonyiwnl/tsek/pull/191) merged on 14 Nov and closed [#141](https://github.com/Anthonyiwnl/tsek/issues/141). It added direct signature, issuer, expiry, subject and algorithm checks and ran the real verifier with a local signing-key service.
- [PR #182](https://github.com/Anthonyiwnl/tsek/pull/182) merged on 14 Nov for the Sprint 3 document replacement and reanalysis work (#30). Its own PR record says authenticated deployed preview/staging acceptance remains pending; it is not counted as a Sprint 4 delivery.
- [PR #190](https://github.com/Anthonyiwnl/tsek/pull/190) started the rollback drill on 14 Nov. [Revert PR #196](https://github.com/Anthonyiwnl/tsek/pull/196) closed [incident #189](https://github.com/Anthonyiwnl/tsek/issues/189), and the recovery run completed the drill. [Rollback record](../ROLLBACK_DRILL.md).
- The INC-08 follow-up verified the staging deploy hook on 14 Nov. [PR #169](https://github.com/Anthonyiwnl/tsek/pull/169), [INC-08](../INCIDENTS.MD#inc-08--staging-render-deploy-hook-returned-http-500).

## Why work slipped

These are evidence-based observations, not a recorded team discussion:

- The scope was larger than backend hardening alone: the plan required application acceptance, AI evaluation, documentation, recovery testing, rehearsal and a tagged release by 8 Nov.
- Pipeline measurement itself was delivered on 8 Nov, but the measured snapshot ended at 09:14 PHT rather than the sprint boundary. No later full-day measurement is present in the repository record.
- At the cutoff the rollback drill, final acceptance, technical documentation, release evidence and several other planned issues had no completed issue record. The rollback drill only began after the sprint, on 14 Nov.
- Review found gaps in direct testing of the real token verifier. The follow-up tests merged after the sprint on 14 Nov. [PR #191](https://github.com/Anthonyiwnl/tsek/pull/191).

## Standups and retrospective

| Evidence | Status |
|---|---|
| Standups (2–3 per week in the plan) | **Missing in the repository and linked Sprint 4 issues.** If dated notes exist elsewhere, link them here; do not reconstruct them from commits. |
| Retrospective | Written review below. A dated team retrospective discussion has yet to be located. |
| Sprint plan | [Course plan, Sprint 4 tab](https://docs.google.com/document/d/1mTKSBYr0hHRpPx4Z7bw_LnE2cheXliboVSehyMURfnI/edit) |
| Issue for process and acceptance evidence | [#40](https://github.com/Anthonyiwnl/tsek/issues/40) requires the sprint records, available standups and final acceptance/rehearsal evidence. |

### Retrospective based on the repository record

- **What went well.** The staging gate stopped a failed deployment before production. Service-aware deployment planning reduced the measured median for merges that changed neither service. Mocked AI failures became part of CI. See [INC-08](../INCIDENTS.MD#inc-08--staging-render-deploy-hook-returned-http-500), [PR #151](https://github.com/Anthonyiwnl/tsek/pull/151), and [PR #156](https://github.com/Anthonyiwnl/tsek/pull/156).
- **What did not go well.** Most original Sprint 4 items stayed open at cutoff. The pipeline snapshot ended before the sprint did, and the rollback, live acceptance, and release evidence remained incomplete. See [pipeline metrics](../PIPELINE_METRICS.MD), [rollback #38](https://github.com/Anthonyiwnl/tsek/issues/38), and [acceptance #40](https://github.com/Anthonyiwnl/tsek/issues/40).
- **Proposed changes.** Give each remaining release check a named owner and an evidence link. Record the full measurement window and the deployed commit when recording a successful check. Link dated standup and retrospective notes as the team makes decisions.

## Process follow-through

No team decision record was found, so these are proposed follow-ups from the
evidence above, not changes already adopted:

- Keep measured claims tied to comparable runs and publish the complete sprint window, including the final day.
- Do not mark live acceptance or rollback complete until the production/staging behavior and recovery evidence are linked.
- Keep the existing reviewed-pull-request, required-check and staging-before-production gates while carrying the open release work to completion.
