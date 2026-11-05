# Service level objectives

"It should work" is not something the team can check. This page turns it into
numbers we measure and agree on (end-term deck, Module 7, "one objective").

- **SLI** (service level indicator): what we measure.
- **SLO** (service level objective): the target for that measurement.
- **Error budget**: the failures the SLO still allows. When it is spent,
  reliability work comes before new features.

## 1. Production is up

| | |
|---|---|
| **SLI** | Share of hourly uptime checks that pass. A check passes when the backend `/health`, the database readiness check `/health/ready` and the frontend all answer HTTP 200 with a complete response within 60 s. A re-run counts by its first attempt |
| **SLO** | **99 %** of checks pass over any 7 days |
| **Error budget** | 1 failed check per 7 days (1 % of 168) |
| **Measured by** | [`uptime.yml`](../.github/workflows/uptime.yml), every hour at :17. Each run's summary shows the 7-day SLI against this SLO |
| **Alert** | A failed check fails the run, and GitHub emails the failure |

The 60 s limit allows for Render's free-tier cold start (up to about 50 s).
A slow answer still counts as up, but the summary shows its time, so a pattern
of slow checks is visible.

## 2. Deploys are safe

| | |
|---|---|
| **SLI** | Share of merges to `main` whose pipeline deploys staging and production and passes both smoke tests, and that are not rolled back afterwards |
| **SLO** | **90 %** per sprint |
| **Error budget** | 1 failed deploy per 10 merges |
| **Measured by** | Production deploys and failed deploys in [`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD), updated before each consultation |

`PIPELINE_METRICS.MD` counts deploys whose deploy or smoke-test step failed.
It does not see a deploy that passed and was rolled back later. Record every
rollback in [`INCIDENTS.MD`](INCIDENTS.MD), and count it as a failed deploy for
that merge when you update the metrics.

## 3. AI verification answers quickly and usably

| | |
|---|---|
| **SLI** | Share of `/api/verify` calls that return a valid result in under 10 s |
| **SLO** | **95 %** over any 7 days |
| **Error budget** | 5 % of calls may fail, time out or be rejected by validation |
| **Measured by** | **Not measured yet (planned).** The daily [AI smoke test](../.github/workflows/ai-smoke.yml) on staging shows each call's time, but it passes any valid answer within 60 s, and the backend does not keep a per-call log yet. Until the smoke test fails answers over 10 s and a per-call log exists (request ID, model, latency, validation result), this SLO is a target, not a measured result |

The 10 s target matches the backend's provider timeout (`OPENAI_TIMEOUT_MS`,
default 10 000 ms): a call that takes longer is already reported to the user
as a timeout.

## When an error budget is spent

1. File an **Incident** issue and add it to [`INCIDENTS.MD`](INCIDENTS.MD).
2. Pause feature pull requests for that part of the system until the cause is
   fixed. Fixes, reverts and documentation still merge.
3. Write a short postmortem and record the recovery time in
   [`PIPELINE_METRICS.MD`](PIPELINE_METRICS.MD).

## Not covered on purpose

- **Keeping Render awake.** Pinging production every 10 minutes would avoid
  cold starts but use about 720 of the workspace's 750 free instance hours a
  month, which staging shares. Before a consultation or Demo Day, wake it by
  hand ([`RUNBOOK.md`](RUNBOOK.md) §5).
- **Load or latency percentiles.** The free tier and class-sized traffic make
  them meaningless; the checks above are what the panel can see.
