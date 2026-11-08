# TSEK Pipeline Optimization Log

## Purpose

Record changes made to improve pipeline speed and reliability. One change
at a time, each with before-and-after numbers measured the same way.

## Summary (#37, 8 Nov 2026)

Every change below was measured on real `main` runs, first attempts that
passed, from the GitHub Actions API. The details, run links and method are in
the sections further down.

| Change | Result | Kept? |
|---|---|---|
| **Optimization 1:** one deploy-and-smoke-test job per environment, 5 jobs → 3 (#99, PR #100) | Job start-up overhead **20 s → 12 s (−40 %)**. Whole pipeline unchanged (128.5 → 129 s), within the hosts' ±25 s build variation | Yes |
| npm download cache (#80) | Install −0.5 s, but restoring and saving the cache cost ~3 s. **No gain** | No |
| **Optimization 3:** smoke tests poll every 3 s, not 10 s (#115, PR #116) | Works (attempts every ~3.1 s), but the ~3.5 s saving per wait is hidden by Render's build variation. **No measurable gain** | Yes, it costs nothing |
| **Optimization 4:** deploy only the services a merge changed (#150, PR #151) | Merges that change neither `backend/` nor `frontend/`: **161 s → 84 s (−48 %)** (median of 3 runs: #151 84 s, #158 64 s, #162 87 s; see "Optimization 4 runs"). Code merges unchanged | Yes |
| Optimization 4 follow-up: test folders and Markdown no longer count as service changes (#166, PR #167) | Replayed on #155 and #160, which rebuilt Render for tests and a README; neither would rebuild now | Pending review |

**Gates stayed effective throughout.**
- The required checks (`Install, lint, build, and test` and `PR links an
  issue`) and the staging → production order never changed.
- No job or required check is skipped.
- Each smoke test still confirms the commit that each service should serve,
  and the database endpoint.
- Sprint 4 had one failed deploy (#114, INC-08). The staging gate stopped it
  before production.

**Remaining bottlenecks.**
1. **The hosts' builds.** A code merge waits 34–40 s per environment for
   Render, or 22–27 s for Vercel, and that is now most of the pipeline. Render
   is also unpredictable: one production build took 9 min 38 s (#160). The
   workflow cannot shorten these builds. #166 at least stops them for changes
   the hosts don't need.
2. **The checks job** grew from 13 s to 17 s median (25–32 s on frontend
   merges) as tests were added. That is the cost of more coverage (#156's named
   AI step alone runs 100 tests), so it is not a regression to undo.
3. **Staging before production is sequential on purpose.** It roughly doubles
   deploy time, but it is the release gate that stopped INC-08, so it stays.

The Sprint 4 row of [`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD) has the
sprint's overall figures.

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
| 2 Nov 2026 (measured 6 Nov) | **Optimization 3:** smoke-test waits poll every **3 s** instead of 10 s (#115, PR #116) | Backend waits: staging median **41 s** (40–61 s), production **31 s** (20–42 s); whole `main` pipeline median **141 s** (107–183 s); 14 runs, 2 Nov | Backend waits: staging median **40.5 s** (35–58 s), production **39 s** (22–60 s); whole pipeline median **157 s** (120–195 s); 10 runs, 2–5 Nov | **Expected 7–10 s per merge not achieved in the measurements.** Polling works (attempts every ~3.1 s in the logs, and some waits now end between 10 s steps), but production's backend wait rose by 8 s, so Render took longer to serve the new commit. Faster polling can only end a wait sooner, so that rise is Render, not this change, and it hides the ~3.5 s per wait the change can save. Kept: it costs only extra `GET /health` requests. See the run list below (#117) |
| 6 Nov 2026 (measured 7 Nov) | **Optimization 4:** each deploy rebuilds only the services whose folder changed since the commit they serve (#150, PR #151) | Merges since 3 s polling (16 runs, 2–6 Nov): changed **neither** folder median **161 s** (125–195 s, 9 runs); **backend only** 148.5 s (124–165 s, 6 runs); **frontend only** 120 s (1 run) | Merges after #151 (7 runs, 6–7 Nov): **neither** median **84 s** (64–87 s, 3 runs: #151, #158, #162); **backend only** 153 s (148–163 s, 3 runs); **frontend only** 128 s (119–159 s, 3 runs) | **Achieved for merges that change neither folder: 161 s → 84 s (−77 s, −48%)**. Each deploy job fell from 44–87 s to 7–30 s because nothing was rebuilt. Three such merges so far (#151, #158 and #162, the last two added on 8 Nov). **No gain for backend-only merges**, as expected: Render's build (34–38 s wait) is still the critical path, and Vercel's skipped build was already hidden behind it. **No measurable gain for frontend-only merges**: the skipped Render wait (35–40 s) was replaced by Vercel's own build wait (22–27 s), but the checks job grew by about 10 s over the same days as frontend tests were added (13–19 s → 25–32 s). Every run also saves one or two hosted builds per environment. Kept. See the run list below (#150) |

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

### Optimization 4 runs (#150)

Same method as #117 (Actions API, first attempts on `main` that passed). The
type comes from the merged pull request's files: whether it changed
`backend/`, `frontend/`, or neither. "Backend wait" and "Frontend wait" are the
smoke-test waits for that service to serve the expected commit.

| Run (merge) | Changed | Total | Checks | Staging job | Production job | Backend wait (stg / prd) | Frontend wait (stg / prd) |
|---|---|---|---|---|---|---|---|
| [41462399408](https://github.com/Anthonyiwnl/tsek/actions/runs/41462399408) (#116) | neither | 161 s | 19 s | 71 s | 55 s | 44 / 22 s | 0 / 0 s |
| 8 more runs, #120 to #146 (5–6 Nov) | neither | 125–195 s (all 9: median 161 s) | 13–24 s | 52–71 s | 44–87 s | 38–58 / 32–60 s | 0–1 s |
| 6 runs #123, #147, #148, #113, #149, #63 | backend | median 148.5 s | 13–17 s | 48–74 s | 48–88 s | 31–47 / 31–74 s | 0–1 s |
| #112 | frontend | 120 s | 18 s | 47 s | 41 s | 35 / 31 s | 0 / 0 s |
| **After #151:** | | | | | | | |
| #151 | neither | **84 s** | 14 s | **30 s** | **27 s** | not rebuilt | not rebuilt |
| #152 | backend | 148 s | 18 s | 63 s | 55 s | 34 / 38 s | not rebuilt |
| #153 | backend | 163 s | 21 s | 64 s | 65 s | 35 / 38 s | not rebuilt |
| #154 | backend | 153 s | 20 s | 62 s | 60 s | 34 / 31 s | not rebuilt |
| #59 | frontend | 159 s | 29 s | 58 s | 60 s | not rebuilt | 25 / 26 s |
| #54 | frontend | 119 s | 25 s | 47 s | 35 s | not rebuilt | 22 / 25 s |
| #55 | frontend | 128 s | 32 s | 46 s | 36 s | not rebuilt | 27 / 22 s |
| [42384748351](https://github.com/Anthonyiwnl/tsek/actions/runs/42384748351) (#158) | neither | **64 s** | 34 s | **9 s** | **7 s** | not rebuilt | not rebuilt |
| [42431172889](https://github.com/Anthonyiwnl/tsek/actions/runs/42431172889) (#162) | neither | **87 s** | 39 s | **28 s** | **9 s** | not rebuilt | not rebuilt |

What this means: the change does what it says. Each run's "Deploy plan"
summary shows which service was rebuilt and why, and the smoke tests accepted
the unchanged service's existing commit every time. The time saved depends on
what a merge touches. A merge that changes neither folder (docs, workflows,
agent files) skips both builds and finishes in about half the time. For code
merges, the pipeline still waits for one host's build, so the total barely
moves. The next real saving would have to shorten the checks job (now 25–32 s
on frontend merges) or the hosts' builds themselves.

### Optimization 3 runs (#117)

Same method as optimization 1: Actions API, first attempts on `main` that
passed, 3-job layout only. A wait is the time of the step "Wait for the
backend to serve this commit". Before = every run from #100 (the 3-job layout)
up to #116; after = every run from #116, the first that polled every 3 s.
#114's run is left out because its first attempt failed (INC-08). Frontend
waits were 0–1 s on both sides, so they are not listed.

| Polling | Run (merge) | Total | Staging backend wait | Production backend wait |
|---|---|---|---|---|
| 10 s | [41387338179](https://github.com/Anthonyiwnl/tsek/actions/runs/41387338179) (#100) | 120 s | 42 s | 30 s |
| 10 s | [41397664867](https://github.com/Anthonyiwnl/tsek/actions/runs/41397664867) (#84) | 164 s | 50 s | 31 s |
| 10 s | [41398826234](https://github.com/Anthonyiwnl/tsek/actions/runs/41398826234) (#82) | 107 s | 41 s | 21 s |
| 10 s | [41399676521](https://github.com/Anthonyiwnl/tsek/actions/runs/41399676521) (#88) | 132 s | 41 s | 32 s |
| 10 s | [41400723244](https://github.com/Anthonyiwnl/tsek/actions/runs/41400723244) (#92) | 129 s | 40 s | 41 s |
| 10 s | [41404173658](https://github.com/Anthonyiwnl/tsek/actions/runs/41404173658) (#110) | 169 s | 41 s | 31 s |
| 10 s | [41406759809](https://github.com/Anthonyiwnl/tsek/actions/runs/41406759809) (#85) | 150 s | 41 s | 30 s |
| 10 s | [41410222546](https://github.com/Anthonyiwnl/tsek/actions/runs/41410222546) (#86) | 153 s | 42 s | 30 s |
| 10 s | [41413091281](https://github.com/Anthonyiwnl/tsek/actions/runs/41413091281) (#87) | 183 s | 40 s | 40 s |
| 10 s | [41413851234](https://github.com/Anthonyiwnl/tsek/actions/runs/41413851234) (#89) | 113 s | 40 s | 20 s |
| 10 s | [41414970812](https://github.com/Anthonyiwnl/tsek/actions/runs/41414970812) (#91) | 130 s | 40 s | 40 s |
| 10 s | [41445144452](https://github.com/Anthonyiwnl/tsek/actions/runs/41445144452) (#104) | 182 s | 61 s | 40 s |
| 10 s | [41448101150](https://github.com/Anthonyiwnl/tsek/actions/runs/41448101150) (#102) | 170 s | 41 s | 42 s |
| 10 s | [41449910304](https://github.com/Anthonyiwnl/tsek/actions/runs/41449910304) (#90) | 130 s | 41 s | 31 s |
| 3 s | [41462399408](https://github.com/Anthonyiwnl/tsek/actions/runs/41462399408) (#116) | 161 s | 44 s | 22 s |
| 3 s | [42036028012](https://github.com/Anthonyiwnl/tsek/actions/runs/42036028012) (#120) | 195 s | 41 s | 60 s |
| 3 s | [42052014287](https://github.com/Anthonyiwnl/tsek/actions/runs/42052014287) (#134) | 164 s | 40 s | 41 s |
| 3 s | [42061551890](https://github.com/Anthonyiwnl/tsek/actions/runs/42061551890) (#124) | 174 s | 39 s | 52 s |
| 3 s | [42062545559](https://github.com/Anthonyiwnl/tsek/actions/runs/42062545559) (#137) | 134 s | 38 s | 38 s |
| 3 s | [42065101106](https://github.com/Anthonyiwnl/tsek/actions/runs/42065101106) (#129) | 153 s | 58 s | 40 s |
| 3 s | [42066504741](https://github.com/Anthonyiwnl/tsek/actions/runs/42066504741) (#121) | 170 s | 41 s | 52 s |
| 3 s | [42068136706](https://github.com/Anthonyiwnl/tsek/actions/runs/42068136706) (#122) | 125 s | 40 s | 32 s |
| 3 s | [42069959854](https://github.com/Anthonyiwnl/tsek/actions/runs/42069959854) (#123) | 133 s | 42 s | 34 s |
| 3 s | [42070594494](https://github.com/Anthonyiwnl/tsek/actions/runs/42070594494) (#112) | 120 s | 35 s | 31 s |

| Stage (median) | 10 s polling (14 runs) | 3 s polling (10 runs) | Change |
|---|---|---|---|
| Staging backend wait | 41 s | 40.5 s | −0.5 s |
| Production backend wait | 31 s | 39 s | +8 s |
| Checks job | 15 s | 17 s | +2 s |
| Job start-up overhead | 13 s | 15 s | +2 s |
| **Whole `main` pipeline** | **141 s** | **157 s** | **+16 s** |

What this means: the change does what it says. Run 42070594494 polls
staging at 17:02:48, :51, :54, :57 and so on, every ~3.1 s. Before the change
all 28 backend waits ended 0–2 s after a 10 s step; after it, several end
between steps (22, 34, 35, 38, 39, 44 s). But a shorter interval can only end a wait
sooner, by about 3.5 s on average (from ~5 s to ~1.5 s of idle time per
wait). That saving is far smaller than the run-to-run spread in how long
Render takes to build and restart (production backend waits ranged from 22
to 60 s after the change), and the after runs came three days later, after
#114 added the authentication code and `jose`. The rise in the pipeline is
Render and the checks taking longer, not the polling. As with optimization 1,
the workflow can no longer win much here: the wait is the hosts' build time.
The next candidate with a real saving is skipping deploys a merge does not
need (path filters): 8 of the 10 after runs above changed nothing in
`backend/` or `frontend/` (docs, workflows and agent files) and still
rebuilt both hosts.

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

1. ~~**Shorter smoke-test polling (#115).**~~ Done in PR #116 and measured on
   10 merges (#117): polling works, but the expected 7–10 s per merge is
   smaller than Render's run-to-run variation, so no gain shows in the
   pipeline time. Kept, because it costs nothing. See "Optimization 3 runs".
2. ~~**Optimization 4: deploy only the services a merge changes (#150).**~~
   Done in PR #151 and measured on 7 merges: a merge that changes neither
   `backend/` nor `frontend/` dropped from a median of 161 s to 84 s. Code
   merges are unchanged, because their time is the host's build. See
   "Optimization 4 runs".
3. ~~**npm cache** in `actions/setup-node`.~~ Measured 3 Nov (#80): no gain,
   not adopted (see the records table).
4. **Mocked LLM in unit tests** (#32), so tests never wait on the provider.

## Measurement Rule

Measure pipeline performance before and after each optimization.
Only report improvements supported by actual measurements.
