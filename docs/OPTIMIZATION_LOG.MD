# TSEK Pipeline Optimization Log

## Purpose

Record changes made to improve pipeline speed and reliability. One change
at a time, each with before-and-after numbers measured the same way.

## Baseline (29 Oct 2026, before any optimization)

Measured with the method in `docs/PIPELINE_METRICS.MD`, Sprint 3 runs up
to 28 Oct 2026 22:57 PHT.

| Pipeline | Runs | Median | 90th percentile | Where the time goes |
|---|---|---|---|---|
| Pull request check job | 50 | 11 s | 16 s | Install 3.6 s (28 %), lint + build + test 2.6 s, setup and checkout the rest |
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

## Optimization Records

| Date | Change | Before | After | Result |
|---|---|---|---|---|
| 29 Oct 2026 | Baseline recorded, no change | — | PR check median 11 s; `main` median 44 s | Reference point for later rows |

## Candidate changes, in planned order

1. **npm cache** in `actions/setup-node` for both lockfiles. Targets the
   install share of the PR check.
2. **Parallel frontend and backend jobs** with **path filters**, so a
   frontend-only PR skips backend work.
3. **Faster staging-to-production hand-off**: keep the smoke test's
   polling interval short and fail fast on a wrong commit.
4. **Mocked LLM in unit tests** (#32), so tests never wait on a paid,
   slow provider.

## Measurement Rule

Measure pipeline performance before and after each optimization.
Only report improvements supported by actual measurements.
