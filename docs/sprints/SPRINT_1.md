# Sprint 1 record: 12–18 October 2026

Goal from the course guide: schema migrated, walking skeleton live, CI on pull
requests, first deployment.

This record lists only what the repository, GitHub Actions and the issue
tracker show. Sprint 1 issues were created late, on 20 October 2026 during
Sprint 2, so they are not backdated. Where evidence is missing, it is marked
missing rather than reconstructed.

Sprint weeks run Monday to Sunday, Philippine time (UTC+8).

## What happened during the sprint (12–18 Oct)

| Date (PHT) | Who | What | Evidence |
|---|---|---|---|
| 13 Oct | Anthony | Repository created, README and `.env.example` added | [`abd4906`](https://github.com/Anthonyiwnl/tsek/commit/abd4906f58e36fdc3614e30a98f32cecdef4b899), [`89618bb`](https://github.com/Anthonyiwnl/tsek/commit/89618bb59943b61065aff3869c96acb664acfe09), [`070a5d1`](https://github.com/Anthonyiwnl/tsek/commit/070a5d1d90bcd1b4be19f67d309cc240649fce7d) |
| 13 Oct | Anthony | DevOps pipeline documentation and first CI workflow drafted on `ci/github-actions` | [`63ffcfb`](https://github.com/Anthonyiwnl/tsek/commit/63ffcfb9daebfbe4513bb89f168b27806c04417e) |
| 13 Oct | Anthony | First CI run failed before any job started (INC-01) | [run 38359619851](https://github.com/Anthonyiwnl/tsek/actions/runs/38359619851) |
| 14–15 Oct | Hero | Homepage committed and PR #1 opened | [`acdcdc4`](https://github.com/Anthonyiwnl/tsek/commit/acdcdc4dafffbb1ba5b73174b004f422ea128b02), [#1](https://github.com/Anthonyiwnl/tsek/pull/1) |

No pull request was merged, no deployment ran, and no backend, database or AI
code was committed during Sprint 1.

## Planned, delivered and slipped

| Issue | Plan | Owner | Status | When it was delivered, or why it slipped |
|---|---|---|---|---|
| [#6](https://github.com/Anthonyiwnl/tsek/issues/6) | Repository setup and issue workflow | Anthony | Done in Sprint 3 | Repository existed in Sprint 1. The issue workflow (issue-link check, PR template, `CONTRIBUTING.md`) merged on 26 Oct in [#43](https://github.com/Anthonyiwnl/tsek/pull/43). |
| [#7](https://github.com/Anthonyiwnl/tsek/issues/7) | Document catalogue schema | Kenlie | Done in Sprint 3 | Schema and migrations merged on 26 Oct in [#4](https://github.com/Anthonyiwnl/tsek/pull/4). Hosted Neon production and staging branches were checked and recorded on the issue. |
| [#8](https://github.com/Anthonyiwnl/tsek/issues/8) | Catalogue API in the backend | Francis | Code merged, not verified live | `GET /api/document-types` and `/requirements` merged on 26 Oct in [#4](https://github.com/Anthonyiwnl/tsek/pull/4). Live check is waiting on a pipeline deployment (#13). First backend commit: 20 Oct. |
| [#9](https://github.com/Anthonyiwnl/tsek/issues/9) | Initial homepage | Hero | Done in Sprints 2–3 | Started in Sprint 1 (PR #1). Merged on 19 Oct ([#1](https://github.com/Anthonyiwnl/tsek/pull/1)), then expanded and merged on 27 Oct ([#3](https://github.com/Anthonyiwnl/tsek/pull/3)). |
| [#10](https://github.com/Anthonyiwnl/tsek/issues/10) | Requirements screen uses the catalogue API | Francis, implemented by Hero | Open | Two open PRs claim it: [#49](https://github.com/Anthonyiwnl/tsek/pull/49) (draft) and [#62](https://github.com/Anthonyiwnl/tsek/pull/62). The team must keep one and close the other. |
| [#11](https://github.com/Anthonyiwnl/tsek/issues/11) | One backend AI provider request | Axel | Open | First commit on 25 Oct. [#42](https://github.com/Anthonyiwnl/tsek/pull/42) is open and waiting on review. |
| [#12](https://github.com/Anthonyiwnl/tsek/issues/12) | Pull request checks | Anthony | Done in Sprints 2–3 | CI on pull requests first passed on 19 Oct ([#2](https://github.com/Anthonyiwnl/tsek/pull/2)). Verification was recorded on 27 Oct ([#50](https://github.com/Anthonyiwnl/tsek/pull/50)). |
| [#13](https://github.com/Anthonyiwnl/tsek/issues/13) | Deployed walking skeleton, merge automation | Anthony | Open | Deploy jobs merged on 26 Oct ([#44](https://github.com/Anthonyiwnl/tsek/pull/44)). The hosting deploy hooks are not configured, so no merge has deployed (INC-02). |
| [#14](https://github.com/Anthonyiwnl/tsek/issues/14) | This record | Francis | This pull request | — |

Summary: 0 of 9 issues were done inside Sprint 1. Four (#6, #7, #9, #12) were
done later, and five are still open.

## Why work slipped

These reasons come from the record, not from a team discussion. Add or correct
them at the retrospective.

- **Issues were created after the sprint.** The plan existed only in the
  [sprint plan document](https://docs.google.com/document/d/1mTKSBYr0hHRpPx4Z7bw_LnE2cheXliboVSehyMURfnI/edit)
  until 20 Oct, so there was no board to track progress during the week.
- **Feature work started in Sprint 2.** The first backend commit was 20 Oct and
  the first AI commit was 25 Oct.
- **Work was held back and merged in large batches.** Most Sprint 1 work merged
  between 26 and 27 Oct. Large stacked pull requests waited days for review.
- **Hosting was never connected to the pipeline,** so no merge could deploy
  (#13, INC-02).

## Pipeline metrics

From [`docs/PIPELINE_METRICS.MD`](../PIPELINE_METRICS.MD), measured from the
GitHub Actions API:

| Avg PR pipeline | Main pipeline | Success rate | Production deploys | Lead time | Failed deploys | Time to recover |
|---|---|---|---|---|---|---|
| — (no PR runs) | — | 0% (0 of 1) | 0 | — | 0 | — |

## Standups and retrospective

| Evidence | Status |
|---|---|
| Standups (2–3 per week required) | **Missing.** None are recorded in the repository or the issues for 12–18 Oct. If notes exist elsewhere (chat, documents), link them here. |
| Retrospective | **Missing.** No Sprint 1 retrospective was held or recorded. Hold one at the next standup and record it below. |
| Consultation log | The sprint plan document holds the plan. This file holds planned vs. delivered vs. slipped. |

### Retrospective (to be filled in by the team)

- What went well:
- What did not go well:
- What we change next sprint:

## Carryover

The open Sprint 1 issues (#8, #10, #11, #13) stay open in the Sprint 1
milestone so the record stays accurate. They are carried into later sprints
without duplicate issues:

| Issue | Blocks |
|---|---|
| #8 | #10, #11 and #13 (each lists #8 as a dependency) |
| #10 | #18, #19 and #20 (frontend application screens stacked on #49) |
| #11 | #21 ([#63](https://github.com/Anthonyiwnl/tsek/pull/63) is stacked on #42) and #27 (AI extraction) |
| #13 | #25 (live CRUD verification) and every deployment metric |

## Process changes adopted

- **1 issue = 1 branch = 1 pull request.** Open the pull request as soon as the
  task is done, and don't bundle several tasks into one.
- **Pull `main` before starting work,** and make sure the local workspace builds
  and passes tests before pulling or pushing.
- **Peer review only.** A teammate approves every pull request. Authors cannot
  approve their own push, and admins cannot bypass this rule. Branch protection
  on `main` enforces it.
