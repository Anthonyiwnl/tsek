# Rollback drill (#38)

A controlled deployment failure, run on purpose, that proves:

- the pipeline stops a bad release at staging before production;
- the last good release keeps serving users;
- the team can restore `main` and both environments with the Rollback
  workflow in [`RUNBOOK.md`](RUNBOOK.md), section 2b.

**Status: run on 14 Nov 2026, 22:54–23:17 PHT. Passed.** Production was
never affected, staging kept serving the last good release, and the pipeline
was green again about 11 minutes after the failure was detected. The record
is below.

## The failure

One line makes the backend exit at start-up **only on Render**. Render sets
`RENDER=true` on its services, while the CI tests and the container check do
not, so every pull request check still passes. That is the kind of failure CI
cannot catch: a release that is fine in tests but does not start on the host.

```js
// backend/src/server.js, first lines after the imports
// Rollback drill (#38): fail start-up on Render only. Revert this commit to recover.
if (process.env.RENDER === 'true') {
  console.error('Rollback drill (#38): start-up failure on purpose.');
  process.exit(1);
}
```

What should happen:

1. The merge's pipeline rebuilds the backend on staging.
2. Render's new staging instance exits. Render keeps the previous instance
   serving, so staging stays up on the last good commit.
3. The staging smoke test waits for the drill commit, gives up after
   10 minutes and fails the run. **Production is never deployed**, so users
   are never affected.
4. The Rollback workflow reverts the drill commit through a reviewed pull
   request. After the revert, `backend/` is identical to the last good commit
   (**G**) that both environments still serve. So the deploy plan (#151,
   #166) rebuilds nothing, and both smoke tests pass on G. **Recovered** means
   the pipeline is green again and `main` matches what is live.
   - If staging's Render instance did go down instead of staying on G, the
     plan cannot read its commit and rebuilds it from the revert. That is
     also a valid recovery, and the record should say which one happened.

## Safety

- **Production is protected by the staging gate.** The production job only
  runs if staging passed.
- **Only the backend is touched.** The deploy plan (#151, #166) rebuilds
  only Render, because only `backend/src/` changes.
- **Pick a quiet time.** While the drill commit is on `main`, any other merge
  would fail staging the same way. Tell the team before you start, and merge
  nothing else until the revert is live.
- **Abort:** if anything unexpected happens, revert the drill commit
  immediately with the Rollback workflow (step 6) and record what happened.

## Steps

Write down the PHT time at each **⏱**.

1. **Announce it** in the group chat. Ask one teammate to be ready to approve
   two pull requests.
2. **Create two issues**, because each pull request closes exactly one:
   - a Task issue, "Rollback drill: ship a backend that fails to start on
     Render", for the drill PR;
   - an Incident issue, "Rollback drill: staging backend fails to start", for
     the revert PR that the Rollback workflow opens.

   Then open the drill PR from a branch `<task issue>-rollback-drill` with the
   patch above, and write `Closes #<task issue>` and `Refs #38` in its
   description.
3. **Merge it** after the checks pass and a teammate approves. ⏱ *merge*.
4. **Watch the run** in Actions → CI and deployment:
   - Staging's "Deploy plan" says backend `deploy = true`, frontend `false`.
   - During the wait, staging `/health` still reports the **previous** commit.
     Screenshot it as proof that users kept the last good release.
   - ⏱ *staging smoke test fails* (about 10 minutes after the hook). This is
     the **detection** time.
   - Production job: not run. Production `/health` still reports the
     previous commit. Screenshot it.
5. **Optional, measure the fast path (RUNBOOK 2a):** in Render, open
   `tsek-api-staging` → Deploys and confirm the drill deploy failed and the
   previous one is still live. No click is needed, because Render never
   switched over. Note that in the record.
6. **Roll back with the workflow (RUNBOOK 2b):** Actions → **Rollback** → Run
   workflow, with `commit` = the drill PR's merge commit and `issue` = the
   incident issue. ⏱ *rollback started*.
7. The workflow opens `revert: …`. If its checks don't start, close and reopen
   it. A teammate approves, then merge it. ⏱ *revert merged*.
8. In the revert's pipeline, each environment's **Deploy plan** should show
   backend `deploy = false`, with the reason "no deployable changes in
   backend/ since G". Both smoke tests then pass on G. ⏱ *production smoke
   test passed*: this is the **recovered** time. `main` and what is live match
   again.
9. **Confirm** that staging and production `/health` still report **G**, the
   last good commit (or the revert's commit, if staging had to be rebuilt),
   and that the site loads and sign-in works.

## Record (14 Nov 2026)

G, the last good backend commit, was `496c664` (#182). Before the drill both
staging and production `/health` reported it. `main` was at `31bdf48` (#183),
which only changed the frontend.

| Field | Value |
|---|---|
| Task / incident issue | #188 / #189 |
| Drill PR / merge commit | #190 / `bcc40bb` (merged 22:54 PHT, approved by Francis) |
| Failing run | [43607301744](https://github.com/Anthonyiwnl/tsek/actions/runs/43607301744): started 22:54:33; deploy plan backend `deploy = true`, frontend `false` |
| Detection (staging smoke test failed) | **23:05:32**: "The staging backend did not report commit bcc40bb… within 10 minutes" (run total 10 min 59 s) |
| Production affected? | **No.** The production job did not run. Production and staging `/health` both stayed on `496c664` (checked 22:54, 22:57, 23:02 and 23:06). |
| Rollback workflow run | [43608397707](https://github.com/Anthonyiwnl/tsek/actions/runs/43608397707): started 23:06:50, 13 s, pushed branch `189-rollback-bcc40bb-43608397707-1` |
| Revert PR / merge commit | #196 / `25b3280`. Opened 23:08:16 (by hand, see below), 12 checks green by 23:09, approved by Francis 23:13:13, merged 23:15:29 |
| Recovery run | [43609196975](https://github.com/Anthonyiwnl/tsek/actions/runs/43609196975): started 23:15:32, 1 min 6 s |
| Deploy plan on the revert run | Both environments: backend `deploy = false` ("no deployable changes in backend/ since 496c664, which it serves"), frontend `false`. Staging never went down, so nothing was rebuilt. |
| Recovered (revert run's production smoke test passed; `main` matches live) | **23:16:38**. Afterwards staging and production `/health` reported `496c664`, `/health/ready` reported `ready`, and the production site loaded. |
| **Time to recover** (detection → revert run green) | **11 min** (23:05:32 → 23:16:38) |
| Time from rollback start to recovered | 9 min 48 s (23:06:50 → 23:16:38) |

### What differed from the plan

- **The Rollback workflow could not open the pull request.** GitHub Actions
  is not allowed to create pull requests in this repository, so the workflow
  pushed the revert branch, took its fallback path and printed a compare
  link. The revert PR (#196) was opened by hand from that link with
  `Closes #189`. This cost about 1.5 minutes.
- **Step 5 (Render dashboard check) was skipped.** The `/health` checks during
  the wait already showed that staging kept serving G.

### Lessons

1. **Most of the recovery time is waiting for a reviewer.** From the revert's
   green checks to the approval took about 4 minutes, and the merge followed
   2 minutes later. On Demo Day, have the approver ready before starting a
   rollback.
2. **Decide on the "Allow GitHub Actions to create and approve pull requests"
   setting.** Turning it on lets the workflow open the revert PR itself. Keeping
   it off is also fine, because the fallback worked; RUNBOOK §2b should then
   say the PR is opened from the compare link.
3. **The staging gate works as designed.** A release that passes every CI
   check but cannot start on the host was stopped at staging, and Render kept
   the previous instance serving. So RUNBOOK §2a (fast rollback in Render)
   would have needed no click for this kind of failure.

## Delivery documentation check (#38)

Checked on 8 Nov 2026 against `main` at `42a07bf`:

| Item | Where | Result |
|---|---|---|
| Pipeline stages, triggers and diagram | [`PIPELINE.md`](../PIPELINE.md) | Updated in this PR: Claude review, path-aware deploys (#151, #166), the mocked AI test step (#156); stale "PR #N" statuses now "Live" |
| Deployment procedure | [`RUNBOOK.md`](RUNBOOK.md) §1 | Complete |
| Rollback runbook | [`RUNBOOK.md`](RUNBOOK.md) §2–3 | Complete; this drill exercises §2b |
| Environment separation | [`STAGING.md`](STAGING.md) | Verified live on 7 Nov: each site calls its own backend and Neon Auth, and each catalogue reads its own database |
| Secrets | GitHub environments, Render, Vercel | Only in host and GitHub settings. Deploy jobs get only the two hook secrets (#96), and the secret scan runs on every PR |
| Required checks | Branch protection on `main` | `Install, lint, build, and test`, `PR links an issue`, `Dependency audit (backend)`, `Dependency audit (frontend)`, `Secret scan (full history)`. `CONTRIBUTING.md` and `PIPELINE.md` corrected in this PR |
| Review rules | Branch protection on `main` | One teammate approval, no self-approval of the last push, stale approvals dismissed, up to date, conversations resolved, admins included |
| Post-deploy verification | `deploy.yml` smoke tests, `uptime.yml` | Each environment confirms the expected commit on the backend and frontend, plus the database endpoint; production is checked hourly against the SLO |
