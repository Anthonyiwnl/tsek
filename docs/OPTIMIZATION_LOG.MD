# TSEK Pipeline Optimization Log

## Purpose

Record changes made to improve pipeline speed and reliability. One change
at a time, each with before-and-after numbers measured the same way.

## Baseline (29 Oct 2026, before any optimization)

Measured with the method in `docs/PIPELINE_METRICS.MD`, Sprint 3 runs up
to 28 Oct 2026 22:57 PHT.

| Pipeline | Runs | Median | 90th percentile | Where the time goes |
|---|---|---|---|---|
| Pull request check job | 50 | 11 s | 16 s | Install 3.6 s on average (28 % of the 12.9 s mean), lint + build + test 2.6 s, setup and checkout the rest |
| `main` pipeline | 8 | 44 s | — | Mostly job start-up for 5 sequential jobs; no real deploy or smoke test runs yet (INC-02) |

### What this baseline means

The pull request pipeline is already fast because `main` holds little
application code. Caching npm can save at most about 3.6 s per run, so
optimizing it now would produce small numbers. The large costs are still
ahead:

- **Real deployments.** Once deploy hooks are configured, the `main`
  pipeline will wait for Render to build and wake (up to 10 minutes are
  budgeted) and for Vercel to build. This will become the slowest stage.
- **Growing test suites.** The stacked frontend and backend PRs add tests
  and the AI evaluation set. Install and test time will rise as they merge.

Re-measure after the stacked PRs and the first real deployment land, then
optimize where the time actually is.

## Re-baseline with real deployments (1 Nov 2026)

Deployments became real on 1 Nov, so the `main` pipeline was re-measured.
Four merges ran with no manual help
([41316410179](https://github.com/Anthonyiwnl/tsek/actions/runs/41316410179),
[41318214204](https://github.com/Anthonyiwnl/tsek/actions/runs/41318214204),
[41318916883](https://github.com/Anthonyiwnl/tsek/actions/runs/41318916883),
[41322017475](https://github.com/Anthonyiwnl/tsek/actions/runs/41322017475)).

| Stage (`main`) | Median | Runs | Share |
|---|---|---|---|
| Checks (install, lint, build, frontend and backend tests) | 15.5 s | 15, 14, 16, 17 | 12 % |
| Staging deploy (trigger hooks) | 10.5 s | 12, 11, 10, 10 | 8 % |
| Staging smoke test (wait for Render and Vercel to serve the commit) | 37 s | 37, 37, 58, 35 | 28 % |
| Production deploy | 11 s | 13, 10, 11, 11 | 8 % |
| Production smoke test | 34 s | 47, 28, 35, 33 | 26 % |
| Job start-up between the 5 sequential jobs | 16.5 s | 18, 14, 16, 17 (each run's total minus its 5 job times) | 12 % |
| **Whole `main` pipeline** | **133 s** | 142, 114, 146, 123 | 100 % |

The pull request check is unchanged at a median of 13 s (110 runs), so
dependency caching would still save only a few seconds. **The time is in the
smoke tests (54 %), which wait for the hosts to build, and in starting five
separate jobs (12 %).** Those are the targets.

## Optimization Records

| Date | Change | Before | After | Result |
|---|---|---|---|---|
| 29 Oct 2026 | Baseline recorded, no change | — | PR check median 11 s; `main` median 44 s | Reference point for later rows |
| 1 Nov 2026 | Re-baseline after real deploys, no change | — | PR check median 13 s; `main` median 133 s; lead time median 136 s | New reference point; see the table above |
| 1 Nov 2026 | Tried: `tsek-staging` builds only production deploys; `tsek` builds previews only when `frontend/` changes (Vercel Ignored Build Step) | About 100 Vercel builds on 1 Nov, which hit the Hobby limit (INC-07) | Not measured | **Reverted the same night** after the account moved to Pro. Kept as a candidate, not a result |
| 2 Nov 2026 | **Optimization 1:** each environment's deploy and smoke test in one job, 5 jobs → 3 (#99, PR #100) | Job start-up overhead median **20 s** (17–26 s); whole `main` pipeline median **128.5 s** (105–153 s); 10 runs, 1–2 Nov | Job start-up overhead median **12 s** (11–14 s); whole pipeline median **129 s** (107–163 s); 5 runs, 2 Nov | **Overhead −8 s (−40 %)**, as predicted. **Whole pipeline unchanged**: run-to-run variation in Render and Vercel build time (±25 s) is three times the saving. See the run list below; recorded in [PR #110](https://github.com/Anthonyiwnl/tsek/pull/110) |
| 3 Nov 2026 | **Tried: npm download cache** in `actions/setup-node` (`cache: npm`, keyed on both lockfiles) (#80) | Cache-related steps (set up Node + both installs + post step) median **5 s**; PR check job median **18 s**; 6 runs on `main` | Cache-related steps median **7 s**; job median **17.5 s**; 6 cache-hit runs (first run was the cache miss and is left out) | **No gain, not adopted.** Installs fell by under 1 s (4.5 → 4 s) but restoring and saving the cache added about 3 s. Job time is within run-to-run noise. Matches the baseline's prediction: install was never where the time is. Kept off; see the run list below |

### npm cache experiment runs (#80)

Same code on both sides: the **Pull request checks** workflow started by hand
(`workflow_dispatch`) on `main` (2085139) and on the branch with only the
cache change, 3 Nov 2026, 21:35–21:43 PHT. Step times are from the Actions
API (1 s resolution). "Cache steps" = Set up Node.js + both installs + Post
Set up Node.js.

| Cache | Run | Cache steps | Installs | Job |
|---|---|---|---|---|
| off | [41645706184](https://github.com/Anthonyiwnl/tsek/actions/runs/41645706184) | 5 s | 3 s | 16 s |
| off | [41645766192](https://github.com/Anthonyiwnl/tsek/actions/runs/41645766192) | 5 s | 5 s | 18 s |
| off | [41645839268](https://github.com/Anthonyiwnl/tsek/actions/runs/41645839268) | 4 s | 4 s | 18 s |
| off | [41645910418](https://github.com/Anthonyiwnl/tsek/actions/runs/41645910418) | 3 s | 2 s | 13 s |
| off | [41645969200](https://github.com/Anthonyiwnl/tsek/actions/runs/41645969200) | 5 s | 5 s | 19 s |
| off | [41646039713](https://github.com/Anthonyiwnl/tsek/actions/runs/41646039713) | 6 s | 5 s | 18 s |
| on (miss) | [41645750374](https://github.com/Anthonyiwnl/tsek/actions/runs/41645750374) | 12 s | 6 s | 23 s |
| on | [41645836928](https://github.com/Anthonyiwnl/tsek/actions/runs/41645836928) | 6 s | 4 s | 17 s |
| on | [41645893320](https://github.com/Anthonyiwnl/tsek/actions/runs/41645893320) | 6 s | 4 s | 18 s |
| on | [41645967871](https://github.com/Anthonyiwnl/tsek/actions/runs/41645967871) | 7 s | 4 s | 17 s |
| on | [41646037589](https://github.com/Anthonyiwnl/tsek/actions/runs/41646037589) | 10 s | 4 s | 21 s |
| on | [41646108638](https://github.com/Anthonyiwnl/tsek/actions/runs/41646108638) | 9 s | 3 s | 20 s |
| on | [41646176273](https://github.com/Anthonyiwnl/tsek/actions/runs/41646176273) | 7 s | 3 s | 17 s |

What this means: the two lockfiles download only a few megabytes, which
GitHub's runners fetch from the npm registry about as fast as they restore
them from the cache. Caching pays off for large dependency trees; ours is
not one yet. Re-try it if installs grow past about 15 s.

### Optimization 1 runs

Measured from the Actions API like the baseline: overhead is each run's total
time minus the sum of its job times; only first attempts that passed.

| Layout | Run (merge) | Total | Job time | Overhead |
|---|---|---|---|---|
| 5 jobs | [41316410179](https://github.com/Anthonyiwnl/tsek/actions/runs/41316410179) (#81) | 145 s | 124 s | 21 s |
| 5 jobs | [41318214204](https://github.com/Anthonyiwnl/tsek/actions/runs/41318214204) | 117 s | 100 s | 17 s |
| 5 jobs | [41318916883](https://github.com/Anthonyiwnl/tsek/actions/runs/41318916883) | 150 s | 130 s | 20 s |
| 5 jobs | [41322017475](https://github.com/Anthonyiwnl/tsek/actions/runs/41322017475) (#68) | 128 s | 106 s | 22 s |
| 5 jobs | [41376440865](https://github.com/Anthonyiwnl/tsek/actions/runs/41376440865) (#42) | 112 s | 93 s | 19 s |
| 5 jobs | [41377410691](https://github.com/Anthonyiwnl/tsek/actions/runs/41377410691) (#61) | 129 s | 109 s | 20 s |
| 5 jobs | [41381164746](https://github.com/Anthonyiwnl/tsek/actions/runs/41381164746) (#62) | 118 s | 99 s | 19 s |
| 5 jobs | [41382637375](https://github.com/Anthonyiwnl/tsek/actions/runs/41382637375) (#106) | 105 s | 86 s | 19 s |
| 5 jobs | [41385077719](https://github.com/Anthonyiwnl/tsek/actions/runs/41385077719) (#66) | 153 s | 127 s | 26 s |
| 5 jobs | [41386906514](https://github.com/Anthonyiwnl/tsek/actions/runs/41386906514) (#108) | 137 s | 116 s | 21 s |
| 3 jobs | [41387338179](https://github.com/Anthonyiwnl/tsek/actions/runs/41387338179) (#100) | 120 s | 108 s | 12 s |
| 3 jobs | [41397664867](https://github.com/Anthonyiwnl/tsek/actions/runs/41397664867) (#84) | 163 s | 152 s | 11 s |
| 3 jobs | [41398826234](https://github.com/Anthonyiwnl/tsek/actions/runs/41398826234) (#82) | 107 s | 95 s | 12 s |
| 3 jobs | [41399676521](https://github.com/Anthonyiwnl/tsek/actions/runs/41399676521) (#88) | 132 s | 118 s | 14 s |
| 3 jobs | [41400723244](https://github.com/Anthonyiwnl/tsek/actions/runs/41400723244) (#92) | 129 s | 117 s | 12 s |

What this means: merging jobs did what it could. Job start-up fell from about
16 % of the pipeline (20 of 128.5 s) to about 9 % (12 of 129 s), but that was
never most of the time. The largest remaining cost is the smoke tests
waiting for Render and Vercel to build (about 54 % in the baseline), and that
wait varies more between runs than any change we can make to the workflow.
Checks and the deploy hooks take the rest. The next candidates should shorten
the waiting itself (polling interval) or skip builds that are not needed, not
change the job layout again.

## Candidate changes, in planned order

Re-ordered on 2 Nov by where the time actually is. Done: **merged deploy
jobs** (#99), measured above (overhead −8 s, whole pipeline unchanged).

1. **Shorter smoke-test polling (#115, in progress).** Measured before the
   change on 14 deploys: every backend wait ended on a multiple of the 10 s
   interval (staging median 41 s, production 31 s; frontend 0–1 s, already
   live by then). Polling every 3 s should save about 5 s per wait, ~10 s per
   merge. The measured result after 5 merges is tracked in #117.
2. **Path filters for deploys.** Skip the Render deploy when a merge does not
   touch `backend/`, and the Vercel deploy when it does not touch
   `frontend/`. Docs-only merges would then deploy nothing and finish in
   about 20 s. Needs care: the smoke test must accept the existing commit.
3. ~~**npm cache** in `actions/setup-node`.~~ Measured 3 Nov (#80): no gain,
   not adopted (see the records table).
4. **Mocked LLM in unit tests** (#32), so tests never wait on the provider.

## Measurement Rule

Measure pipeline performance before and after each optimization.
Only report improvements supported by actual measurements.
