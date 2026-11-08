# Rollback drill (#38)

A controlled deployment failure, run on purpose, that proves:

- the pipeline stops a bad release at staging before production;
- the last good release keeps serving users;
- the team can restore `main` and both environments with the Rollback
  workflow in [`RUNBOOK.md`](RUNBOOK.md), section 2b.

**Status: prepared, not yet run.** Run it on the near-final build, after the
team's last code pull requests merge and before the v1.0.0 release (#41).

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
   request. Its merge deploys staging, then production, and both smoke tests
   pass.

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
8. The revert's pipeline rebuilds the backend on staging, then production.
   ⏱ *production smoke test passed*. This is the **recovered** time.
9. **Confirm** that staging and production `/health` both report the revert's
   merge commit, and that the site loads and sign-in works.

## Record (fill in after the drill)

| Field | Value |
|---|---|
| Incident issue | # |
| Drill PR / merge commit | # / `` |
| Failing run | [link]() |
| Detection (staging smoke test failed) | |
| Production affected? | No: production job not run; `/health` stayed on `` |
| Rollback workflow run | [link]() |
| Revert PR / merge commit | # / `` |
| Recovery run | [link]() |
| Recovered (production smoke test passed) | |
| **Time to recover** (detection → recovered) | min |
| Time from rollback start to recovered | min |

Then:

- add an `INC-XX` row and section to [`INCIDENTS.MD`](INCIDENTS.MD). Mark it
  **planned drill**, with cause, evidence links, time to recover and lessons;
- count it in the Sprint 4 row of [`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD)
  as a failed deploy, with its recovery minutes, and say it was a drill;
- tick #38's acceptance criteria with links to this record.

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
