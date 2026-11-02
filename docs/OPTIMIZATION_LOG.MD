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
| 2 Nov 2026 | **Optimization 1:** each environment's deploy and smoke test in one job, 5 jobs → 3 (#99, PR #100) | Job start-up overhead median **20 s** (17–26 s); whole `main` pipeline median **128.5 s** (105–153 s); 10 runs, 1–2 Nov | Job start-up overhead median **12 s** (11–14 s); whole pipeline median **129 s** (107–163 s); 5 runs, 2 Nov | **Overhead −8 s (−40 %)**, as predicted. **Whole pipeline unchanged**: run-to-run variation in Render and Vercel build time (±25 s) is three times the saving. See the run list below |
| 1 Nov 2026 | Tried: `tsek-staging` builds only production deploys; `tsek` builds previews only when `frontend/` changes (Vercel Ignored Build Step) | About 100 Vercel builds on 1 Nov, which hit the Hobby limit (INC-07) | Not measured | **Reverted the same night** after the account moved to Pro. Kept as a candidate, not a result |

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

What this means: merging jobs did what it could, but job start-up was only
about 15 % of the pipeline. The rest is the smoke tests waiting for Render
and Vercel to build, and that time varies more than any change we can make
in the workflow. The next candidates should shorten the waiting itself
(polling interval) or the builds, not the job layout.

## Candidate changes, in planned order

Re-ordered on 1 Nov by where the time actually is:

1. **Fewer, merged deploy jobs.** Combine each environment's deploy and
   smoke test into one job (#99). The 5 sequential jobs have 4 hand-offs;
   this removes 2 of them, so expect roughly half of the ~16.5 s overhead
   (~8 s) back. Re-measure after it merges.
2. **Shorter smoke-test polling.** The smoke tests poll every 10 s; polling
   every 5 s should cut up to ~5 s per wait (two waits per environment).
3. **Path filters for deploys.** Skip the Render deploy when a merge does not
   touch `backend/`, and the Vercel deploy when it does not touch
   `frontend/`. Docs-only merges would then deploy nothing and finish in
   about 20 s. Needs care: the smoke test must accept the existing commit.
4. **npm cache** in `actions/setup-node`. Small: install is a few seconds of
   the 13 s PR check.
5. **Mocked LLM in unit tests** (#32), so tests never wait on the provider.

## Measurement Rule

Measure pipeline performance before and after each optimization.
Only report improvements supported by actual measurements.
