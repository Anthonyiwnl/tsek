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
| Job start-up between the 5 sequential jobs | ~25 s | total 133 s minus job time 108 s | 19 % |
| **Whole `main` pipeline** | **133 s** | 142, 114, 146, 123 | 100 % |

The pull request check is unchanged at a median of 13 s (110 runs), so
dependency caching would still save only a few seconds. **The time is in the
smoke tests (54 %), which wait for the hosts to build, and in starting five
separate jobs (19 %).** Those are the targets.

## Optimization Records

| Date | Change | Before | After | Result |
|---|---|---|---|---|
| 29 Oct 2026 | Baseline recorded, no change | — | PR check median 11 s; `main` median 44 s | Reference point for later rows |
| 1 Nov 2026 | Re-baseline after real deploys, no change | — | PR check median 13 s; `main` median 133 s; lead time median 136 s | New reference point; see the table above |
| 1 Nov 2026 | Tried: `tsek-staging` builds only production deploys; `tsek` builds previews only when `frontend/` changes (Vercel Ignored Build Step) | About 100 Vercel builds on 1 Nov, which hit the Hobby limit (INC-07) | Not measured | **Reverted the same night** after the account moved to Pro. Kept as a candidate, not a result |

## Candidate changes, in planned order

Re-ordered on 1 Nov by where the time actually is:

1. **Fewer, merged deploy jobs.** Combine each environment's deploy and
   smoke test into one job (#99). The 5 sequential jobs have 4 hand-offs;
   this removes 2 of them, so expect roughly half of the ~25 s overhead
   (~12 s) back. Re-measure after it merges.
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
