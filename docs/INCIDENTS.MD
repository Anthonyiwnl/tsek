# TSEK CI/CD Incidents

## Purpose

Record significant CI failures, deployment problems, and
recovery actions. Each incident gets a short postmortem using the
template at the end of this file.

## If the secret scan finds a real secret

Act in this order; the details are in
[`CI_CD.md`](CI_CD.md#security-checks).

1. **Rotate it first**, in the provider's dashboard (OpenAI, Neon, Render,
   Vercel), and update every place it is used. Deleting the commit does not
   make a pushed secret safe; rotating it does.
2. **Then tell the team** and open an incident below, with when it was
   pushed, when it was rotated and what had access to it in between.
3. Never add a real secret to the `.gitleaks.toml` allowlist.

## Incident Log

| ID | Opened (PHT) | Title | Status | Time to recover |
|---|---|---|---|---|
| INC-01 | 13 Oct 2026 14:56 | First CI workflow failed to start | Resolved 19 Oct 2026 | 6 days |
| INC-02 | 27 Oct 2026 01:23 | `main` pipeline reports successful deploys that deploy nothing | Resolved 1 Nov 2026 22:59 | 5 days 22 h |
| INC-03 | 29 Oct 2026 | Public frontend serves a commit that is not on `main` | Mitigated 1 Nov 2026 | — |
| INC-04 | 27 Oct 2026 01:23 | AI review has never completed a review (OpenAI HTTP 429) | Resolved 2 Nov 2026 00:52 | 5 days 23 h |
| INC-05 | 1 Nov 2026 19:46 | Deploy jobs received empty hook secrets after #94 | Resolved 1 Nov 2026 21:05 | 79 min |
| INC-06 | 1 Nov 2026 21:06 | Staging hook deployed production; Render services on the wrong branch | Resolved 1 Nov 2026 22:15 | 69 min |
| INC-07 | 1 Nov 2026 23:05 | Vercel free-plan deployment limit reached | Resolved 1 Nov 2026 23:31 | 26 min |
| INC-08 | 4 Nov 2026 23:09 | Staging Render hook returned HTTP 500 | Resolved 5 Nov 2026 16:52; staging hook verified 14 Nov | ~17 h 43 min |
| INC-09 | 14 Nov 2026 23:05 | Planned rollback drill: staging backend fails to start (#38) | Resolved 14 Nov 2026 23:16 | 11 min |
| INC-10 | 15 Nov 2026 ~14:27 | Instructions inside a document could steer the AI document check (prompt injection) | Resolved 15 Nov 2026 ~14:48 | ~21 min |
| INC-11 | 15 Nov 2026 15:09 | Planned staging AI failure and recovery drill | Both credential failure checks and final recovery verified | ~2 h (reported) |
---

### INC-01 · First CI workflow failed to start

**Incident.** The first push of `.github/workflows/ci.yml` to the
`ci/github-actions` branch produced a run that failed before any job
started ([run 38359619851](https://github.com/Anthonyiwnl/tsek/actions/runs/38359619851),
0 jobs).

**Impact.** No checks ran on that branch. No pull request, deployment or
user was affected, so the 6-day recovery had no user impact.

**Root cause.** GitHub rejected the workflow file at startup (a workflow
definition error rather than a failing step).

**Resolution.** The workflow was corrected before PR #2 was opened. PR #2's
check passed on 19 Oct
([run 39273266612](https://github.com/Anthonyiwnl/tsek/actions/runs/39273266612)).

**Prevention.** Workflow changes arrive through pull requests, so a broken
workflow fails on its own PR instead of on `main`.

---

### INC-02 · `main` pipeline reports successful deploys that deploy nothing

**Incident.** Since the staging and production jobs merged in PR #44, all 8
`main` runs show green `Staging / Deploy`, `Staging / Smoke test`,
`Production / Deploy` and `Production / Smoke test` jobs, for example
[run 40453800570](https://github.com/Anthonyiwnl/tsek/actions/runs/40453800570).
In every run the Vercel and Render trigger steps and all three smoke-test
checks were skipped.

**Impact.** No merge to `main` has reached a live environment through the
pipeline. Anyone reading the Actions tab would count 8 successful
production deploys; the true number is 0. Issue #13 requires that
missing deployment configuration is not reported as a successful deployment.

**Root cause.** The `VERCEL_DEPLOY_HOOK_URL` and `RENDER_DEPLOY_HOOK_URL`
environment secrets and the `FRONTEND_URL`, `BACKEND_HEALTHCHECK_URL` and
`DATABASE_CHECK_URL` variables are not set in the `staging` and
`production` GitHub environments. `deploy.yml` deliberately skips a missing
hook and only writes a note to the job summary, so the job still passes.

**Resolution.** Resolved 1 Nov 2026.

1. The deploy hooks and smoke-test URLs were added to both GitHub
   environments (production on 27 Oct, staging on 1 Nov).
2. #58 made `/health` report the deployed commit.
3. #67 makes a missing deploy hook **fail** the deploy job before either
   hook runs, and a missing smoke-test URL fail the smoke-test job before it
   starts polling. Both name the missing setting.

The first merge deployed and verified end to end by the pipeline alone was
[run 41316410179](https://github.com/Anthonyiwnl/tsek/actions/runs/41316410179)
(#81, 1 Nov 22:29). #67 merged at 22:59, and its own run passed with the
new checks in place
([run 41318916883](https://github.com/Anthonyiwnl/tsek/actions/runs/41318916883)).

**Prevention.** Step 3 above (#67). A deploy job that cannot deploy is now red.

---

### INC-03 · Public frontend serves a commit that is not on `main`

**Incident.** On 29 Oct 2026 the public frontend
`https://tsek-app.vercel.app` reported `tsek-commit`
`34eba2b2a87897407a7603d9c404c506773fa0f6`. That commit is the head of
`codex/60-figma-ui-logo` (draft PR #61), which is not merged. `main` is at
`1c35fee`.

**Impact.** The course requires production to always reflect `main`. The
public site currently shows unreviewed work, and a demo from it would not
match the repository.

**Root cause.** Confirmed 1 Nov: TSEK had two sets of Vercel projects.
`tsek-app.vercel.app` and `tsek-staging-xi.vercel.app` belong to Hero's
original account and deploy branches through their own Git integration. The
pipeline deploys to the DevOps Engineer's `tsek` (production,
`tsek-seven.vercel.app`) and `tsek-staging` projects.

**Resolution.** Mitigated 1 Nov. The team uses `tsek-seven.vercel.app` as the
production URL, because only projects in the DevOps account can be rolled
back from the dashboard during a demo (Vercel's free plan cannot share
projects). Since 1 Nov it serves `main` and is verified by the production
smoke test on every merge. Open: Hero's projects still exist and serve old
commits. They should be retired, or at least never shared as the production
link.

**Prevention.** The production smoke test compares the served `tsek-commit`
with the commit being deployed, so it fails if production drifts from
`main` once `FRONTEND_URL` is configured.

---

### INC-04 · AI review has never completed a review

**Incident.** Since `ai-review.yml` merged in PR #47, every TSEK AI review
comment reports that OpenAI returned HTTP 429. The workflow itself passes.
Evidence:
[PR #47](https://github.com/Anthonyiwnl/tsek/pull/47#issuecomment-6419578078) (27 Oct 01:23),
[PR #58](https://github.com/Anthonyiwnl/tsek/pull/58#issuecomment-6435810830),
[PR #62](https://github.com/Anthonyiwnl/tsek/pull/62#issuecomment-6438683239),
[PR #63](https://github.com/Anthonyiwnl/tsek/pull/63#issuecomment-6472325705),
[PR #66](https://github.com/Anthonyiwnl/tsek/pull/66#issuecomment-6488296743) (29 Oct).

**Impact.** No AI review has reached a pull request; only the automatic
secret and frontend-access checks ran. The fallback worked as designed and
no merge was blocked.

**Root cause.** Likely: the OpenAI account behind `AI_REVIEW_OPENAI_API_KEY`
had no billing or credits, which OpenAI reports as HTTP 429. The script did
not log the 429 response body, so the exact OpenAI error type was not
recorded. The 429s stopped once prepaid credit was added and the secret was
replaced with a key from a funded project (below).

**Resolution.** Resolved 2 Nov 2026 00:52. The DevOps Engineer, who manages
the team's OpenAI account, added prepaid credit (auto-recharge off) and split
usage into three OpenAI projects, each with its own key and a hard monthly
spend limit: `tsek-staging` (Render staging), `tsek-prod` (Render
production) and `tsek-ai-review` (this GitHub secret). The first completed AI
review is on
[PR #66](https://github.com/Anthonyiwnl/tsek/pull/66) (re-run of
[run 41324409404](https://github.com/Anthonyiwnl/tsek/actions/runs/41324409404)):
risk low, all project rules checked.

**Prevention.** Count a 429 or provider failure as a failed review in the
metrics log, and add a scheduled live smoke test of the provider (PR #90).
A spend limit reached now also shows as HTTP 429
(`project_spend_limit_exceeded`), so check the project's usage first.

---

### INC-05 · Deploy jobs received empty hook secrets after #94

**Incident.** #94 moved the deploy jobs into `deploy-main.yml` and, following
a review suggestion, stopped passing secrets to the reusable `deploy.yml`.
The next three `main` runs
([41303385163](https://github.com/Anthonyiwnl/tsek/actions/runs/41303385163),
[41307818998](https://github.com/Anthonyiwnl/tsek/actions/runs/41307818998),
[41308583202](https://github.com/Anthonyiwnl/tsek/actions/runs/41308583202))
started the staging deploy with both hook secrets empty. The deploy job
skipped both hooks and stayed green (INC-02 behaviour, #67 not yet merged).
The staging smoke test then timed out after 10 minutes.

**Impact.** Three merges were not deployed. Production was not touched,
because the failed staging smoke test blocked it.

**Root cause.** GitHub's documentation: a reusable workflow only receives
secrets the caller passes, even environment secrets; otherwise "the secret
resolves to an empty string … The workflow run doesn't show an error." The
review suggestion said the opposite and was applied without checking the
documentation.

**Resolution.** #96 passes exactly the two hook secrets by name (not every
secret), and `deploy.yml` declares them. Merged 21:05; the next run's hooks
fired.

**Prevention.** #67 now fails a deploy whose hooks are empty, so this shows
as red within seconds instead of after a 10-minute smoke test. Review
suggestions that change secret or deploy wiring are checked against GitHub's
documentation before merging.

---

### INC-06 · Staging hook deployed production; Render services on the wrong branch

**Incident.** The first deploy with secrets
([run 41309599966](https://github.com/Anthonyiwnl/tsek/actions/runs/41309599966),
attempts 1–3) found three configuration errors in turn:

1. The `staging` environment's `VERCEL_DEPLOY_HOOK_URL` held the
   **production** project's hook. The staging step at 21:06 deployed `main`
   to the production frontend (`tsek-seven.vercel.app`), and `tsek-staging`
   was never built.
2. Render `tsek-api-staging` was connected to branch
   `backend/applications-crud` (PR #5's branch), so its hook rebuilt that
   branch, not `main`.
3. Render `tsek-fl10` (production) was also not on `main`.

**Impact.** The production frontend received `main` (0304513) without
passing the staging smoke test. It was a working build and was confirmed
by the later green run. Staging and production backends kept serving old
code. The staging gate stopped the backend problems from reaching
production.

**Root cause.** Hosting settings entered by hand were never verified
against the pipeline: hooks copied from the wrong project, and services
created from feature branches.

**Resolution.** The staging and production Vercel hook secrets were re-set
from each project's own deploy hook. The Render staging and production
services were switched to `main`. A full re-run (attempt 4, 22:14) passed
staging and production. Lesson: "Re-run failed jobs" only re-ran the smoke
test, not the deploy, so a full re-run was needed.

**Prevention.** The backend and frontend smoke tests compare the served
commit with the run's commit, so a wrong hook or branch for either service
fails the run. The database check only verifies that the endpoint answers.
This incident also showed the limit of the staging gate: a staging secret
that holds the production hook deploys production before staging is tested.
The runbook (#88) lists the expected branch and hook for each environment,
to check whenever a hook is replaced.

---

### INC-07 · Vercel free-plan deployment limit reached

**Incident.** On 1 Nov about 23:05, Vercel stopped creating deployments
("Deployment rate limited — retry in 24 hours"), shown as a red
`Vercel – tsek-staging` status on PR #68.

**Impact.** Pull request previews stopped. Any merge would have failed its
staging deploy until the limit reset, so #68 was held.

**Root cause.** The Hobby plan allows 100 deployments per day per account.
Both `tsek` and `tsek-staging` built a preview for every push to every PR
branch, and about 30 PR updates that day used up the allowance.

**Resolution.** The Vercel account was upgraded to Pro (6,000 deployments
per day) at 23:28. The rate-limited preview for #68 was rebuilt from the
Vercel dashboard (23:31), and #68 merged and deployed green.

**Prevention.** Measured as an optimization candidate: building
`tsek-staging` only for production deploys, and `tsek` previews only when
`frontend/` changes, would cut builds per busy day from about 100 to about
15–20. This was tried and then reverted after the upgrade; see the
optimization log.

---

### INC-08 · Staging Render deploy hook returned HTTP 500

**Incident.** [Run #30](https://github.com/Anthonyiwnl/tsek/actions/runs/41854655436)
failed on 4 Nov 2026 at 23:09 PHT when the staging Render hook returned HTTP 500.

**Impact.** Staging deployment stopped. Production was skipped, protecting it from this release.

**Root cause.** The HTTP 500 cause remains unconfirmed. A separate staging branch
mismatch was found: `backend-16-create-read` instead of `main`. Neither service was suspended.

**Resolution.** Francis changed staging to `main` (independently verified) and
confirmed `NEON_AUTH_BASE_URL` is present; its value was not inspected.
Staging's manual deployment became live on 5 Nov at 16:48 PHT.
Run #30 attempt 2 passed all checks and both environments' smoke tests.
Production's hook deployment became live at 16:52 PHT. Both Render backends
are live on `745ba943114de62b629072e020956b8ac779ab14`.
Independent unauthenticated requests to `/api/applications` returned HTTP 401
with `MISSING_BEARER_TOKEN` on both staging and production.

Staging deployment: `dep-dbm45fbm8hqs73em8i10`.
Production deployment: `dep-dbm47d3bc2fs73898d0g`.

**Open follow-up.** Attempt 2 skipped staging hooks because the commit was
already live. The original staging hook has not been proven repaired.
Verify it at the next authorized staging deployment. No hook regeneration
is confirmed.

**Follow-up closed (14 Nov 2026).** The staging hook has since rebuilt the
backend from the pipeline: the merge of #187
([run 43582339147](https://github.com/Anthonyiwnl/tsek/actions/runs/43582339147))
planned a staging backend deploy of `9c75445`, and the staging smoke test
confirmed it. The INC-09 drill also fired the staging hook.

**Prevention.** Retain the staging gate and commit-aware smoke tests.
Verify service branches and environment-specific hooks whenever settings change.

---

### INC-09 · Planned rollback drill: staging backend fails to start

**Planned drill** for #38, run as described in
[`ROLLBACK_DRILL.md`](ROLLBACK_DRILL.md), which has the full record.
Task #188, incident #189.

**Incident.** #190 merged at 22:54 PHT (`bcc40bb`). It makes the backend exit
at start-up only when `RENDER=true`, so every pull request check passed. The
pipeline ([run 43607301744](https://github.com/Anthonyiwnl/tsek/actions/runs/43607301744))
rebuilt the staging backend, and the staging smoke test failed at 23:05:32
because staging never reported the new commit.

**Impact.** None for users. The production job did not run. Render kept the
previous staging instance serving, so staging and production `/health` stayed
on the last good commit `496c664` throughout. Merges to `main` were paused
from 22:54 to 23:16.

**Root cause.** Deliberate: a release that passes CI but cannot start on the
host.

**Resolution.** The Rollback workflow
([run 43608397707](https://github.com/Anthonyiwnl/tsek/actions/runs/43608397707),
23:06:50) pushed a revert branch. GitHub Actions is not allowed to open pull
requests here, so the revert PR #196 was opened by hand from the workflow's
compare link at 23:08:16. Francis approved it, it merged at 23:15:29
(`25b3280`), and the recovery run
([43609196975](https://github.com/Anthonyiwnl/tsek/actions/runs/43609196975))
passed both smoke tests at 23:16:38 without rebuilding anything. **Time to
recover: 11 min** from detection.

**Prevention / lessons.** Have a reviewer ready before starting a rollback,
since waiting for approval was most of the recovery time. Decide whether to
allow GitHub Actions to open pull requests, or document the manual step in
RUNBOOK §2b. The staging gate stopped a release that CI could not catch.

---

### INC-10 · Instructions inside a document could steer the AI document check

**Incident.** While evaluating prompt 1.1.0 (#213), Axel ran the released
v1.0.0 prompt live on `gpt-4.1-mini` against the fixed #31 set. Case 15 is a
letter with a paragraph addressed to the AI that claims the document is a
passport for a named applicant. The model followed it: it reported a passport,
copied the made-up name and address, and the backend marked the
"Valid government-issued ID" requirement complete. Reported to the team at
about 14:27 PHT on 15 Nov. Results:
[`production-prompt-before-after`](../scripts/eval/results/production-prompt-before-after/report.md).

**Impact.** Released v1.0.0 in staging and production. Someone could upload a
document whose text tells the AI what to report and get a requirement marked
complete. It was found with synthetic test documents; no use of it was
reported.

**Root cause.** The #31 evaluation replayed prewritten model answers, so the
live model was never tested on case 15. The backend kept any extracted value
that appeared anywhere in the document text, including text written to
instruct the AI.

**Resolution.** #214 (`8aeeb82`) merged at 14:45:54 and the pipeline deployed
it to staging and production by about 14:48
([CI and deployment #89](https://github.com/Anthonyiwnl/tsek/actions/workflows/deploy-main.yml)).
Prompt 1.1.0 tells the model to ignore claims inside AI-directed passages. The
backend now removes paragraphs that start like an instruction to the AI before
calling the model, and erases any returned value that does not appear in the
remaining text. A regression test replays case 15 with a forged model answer.
Live, case 15 now returns `LETTER` with no applicant or address and the
requirement stays uncertain. Released as v1.1.0. **Time to recover: about
21 min** from the report.

**Prevention / lessons.** Run every prompt change live against the fixed set,
including the injection case, not only with mocked answers. The paragraph
filter only recognizes common phrasings ("note to the AI:", "ignore previous
instructions"); a differently worded instruction would reach the model, so
the check that values must appear in the remaining text is the main safeguard.
Keep adding injection variants to the evaluation set.


---

### INC-11 · Planned staging AI failure and recovery drill

This planned drill was performed on **staging only**. Production was not
changed. Times are Philippine Time (PHT, UTC+8). The interruption window
below is approximate and was reported by Francis; the GitHub Actions run
times are independently visible.

Francis reported that staging AI was unavailable from about **15:09 to
17:09 PHT** because the staging key had not been restored correctly. A new
staging key restored service. Francis also clarified that the HTTP 429 seen
during recovery was TSEK's per-user rate limit, not an OpenAI rate limit.

| Drill step | Time (PHT) | Result and evidence |
|---|---|---|
| 1. Record the baseline timeout and confirm the real staging key | 15:09 onward | Incomplete: the secret value was not inspected. The 15:09 staging smoke run failed; Francis later reported the key had not been restored correctly. No credential value is recorded here. |
| 2. Set the short timeout and expect `PROVIDER_TIMEOUT` | 15:23 | Passed as a failure scenario: [AI smoke run #16, attempt 1](https://github.com/Anthonyiwnl/tsek/actions/runs/43689755236/attempts/1) recorded HTTP 504 `PROVIDER_TIMEOUT`; the staging health wake-up passed. The workflow is red because its ordinary smoke check expects HTTP 200. |
| 3. Restore the normal timeout | After step 2; exact time not recorded | Render reported the restoration deployment live ([deployment](https://dashboard.render.com/web/srv-dbjgp0ajnfac73fuvvv0/deploys/dep-dbslt8gn74is73a97ang)). Francis later confirmed the empty timeout row was removed. Key restoration was incomplete, according to Francis. |
| 4. Substitute an invalid key and expect `PROVIDER_ERROR` | 18:47 | [Smoke run #21](https://github.com/Anthonyiwnl/tsek/actions/runs/43705725230) returned HTTP 502 `PROVIDER_ERROR` after the [18:46 staging deployment](https://dashboard.render.com/web/srv-dbjgp0ajnfac73fuvvv0/deploys/dep-dbsoqhrl550s73929oh0). The health wake-up passed and Render logged HTTP 401 from OpenAI during the verification call. |
| 5. Remove the key and expect `MISSING_CREDENTIALS` | 18:21 | [AI smoke run #17, attempt 2](https://github.com/Anthonyiwnl/tsek/actions/runs/43697208548/attempts/2) recorded HTTP 503 `MISSING_CREDENTIALS`, as shown in the Actions summary screenshot Francis supplied, after the [18:20 staging deployment](https://dashboard.render.com/web/srv-dbjgp0ajnfac73fuvvv0/deploys/dep-dbsoefrbc2fs73c4hftg). The staging health wake-up passed. |
| 6. Restore a valid staging key and expect `OK` | 17:10 | Passed: [AI smoke run #18](https://github.com/Anthonyiwnl/tsek/actions/runs/43697966431) completed successfully; GitHub confirms its authenticated staging health and AI-call steps passed. Francis reports HTTP 200 from `gpt-4.1-mini` in about 2 seconds. The recovery followed replacement with a new staging key. |

A local attempt using the stale checkout at commit `50b513a` returned HTTP
401 `MISSING_BEARER_TOKEN`; it is not a success result. The current main
branch drill requires `AI_VERIFY_TOKEN`. [AI smoke run #20](https://github.com/Anthonyiwnl/tsek/actions/runs/43701835757) confirmed staging recovery at 17:59 PHT after the 17:55 deploy. The later 18:21 response was HTTP 503. After the [18:29 staging deployment](https://dashboard.render.com/web/srv-dbjgp0ajnfac73fuvvv0/deploys/dep-dbsoiot6e07s73ae9do0), [smoke run #17, attempt 3](https://github.com/Anthonyiwnl/tsek/actions/runs/43697208548/attempts/3) passed staging health and the authenticated AI call at 18:30 PHT. After the [18:51 restoration deployment](https://dashboard.render.com/web/srv-dbjgp0ajnfac73fuvvv0/deploys/dep-dbsot9rbc2fs73c5kbbg), [smoke run #21, attempt 2](https://github.com/Anthonyiwnl/tsek/actions/runs/43705725230/attempts/2) passed at 18:52 PHT. The staging health wake-up and authenticated AI call both passed, including HTTP 200 and a valid result.

The local drill on `main` commit `19f0c7d` passed all eight scenarios. An additional localhost run made the mock provider reject the dummy key with HTTP 401 and confirmed TSEK returned HTTP 502 `PROVIDER_ERROR`. The missing-key case returned HTTP 503 `MISSING_CREDENTIALS`. Both local runs also checked health and catalogue availability.

---

## Incident Record Template

### INC-NN · Title

**Incident.** What happened, with run or deployment links.

**Impact.** Which component, workflow or users were affected.

**Root cause.** The identified cause. Mark it "likely" until confirmed.

**Resolution.** How it was fixed, or the open steps.

**Prevention.** How a repeat will be caught or prevented.