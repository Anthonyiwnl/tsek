# Security review

The Sprint 4 security review, done against the team's 15-point security
checklist and finished with a Strix penetration test of staging. Each row
says how TSEK meets the point, where the proof is, and who owns what is
left. The threat model behind it is in [`THREAT_MODEL.md`](THREAT_MODEL.md).

Legend: ✅ done · 🟡 partly done, open item linked · 🔴 missing

## Checklist

| # | Check | Status | How TSEK meets it | Evidence | Owner of open work |
|---|---|---|---|---|---|
| 1 | Add security headers | 🟡 | API: `helmet` on every response. Frontend: CSP, frame, nosniff, referrer, permissions, HSTS, COOP headers in #297 | `backend/src/app.js`, `frontend/vercel.json` | Anthony (#291) |
| 2 | Add proper authentication | ✅ | Neon Auth issues sessions; the API checks every token's signature, issuer, subject and expiry against the JWKS, and answers `503` (never a pass) when the JWKS is down | `backend/src/auth.js`, `backend/test/auth-verifier.test.js` | — |
| 3 | Hide your API keys | ✅ | OpenAI and database keys live only in Render; one key per environment with spend caps; the bundle audit fails if the frontend contains a key, `api.openai.com` or a server secret name; Gitleaks scans the full history | `bundle-audit.yml`, `security.yml`, `docs/MAINTENANCE.md` | — |
| 4 | Secure your database | 🟡 | Verified TLS (`sslmode=verify-full`), parameterized SQL only, owner scoping on every query. The API still connects as the owner role; #298 moves it to a role that can only read and write rows | `backend/src/config.js`, `backend/scripts/app-role.js` | Anthony (#292) |
| 5 | Limit user access | ✅ | Every application, file and analysis query filters by the signed-in owner and answers `404` for anyone else's; staff access comes only from the `staff_roles` table, checked on each request | `backend/src/applications.js`, `application-files.js`, `docs/staff-dashboard.md` | — |
| 6 | Protect against XSS | 🟡 | React escapes all text; no `innerHTML` or `dangerouslySetInnerHTML`; downloads are sent as attachments. The CSP in #297 blocks injected scripts as a second layer | `frontend/src`, `frontend/tests/security-headers.test.js` | Anthony (#291) |
| 7 | Add rate limiting | 🟡 | AI routes: 3 per minute and 20 per day per user, 60 per hour overall, plus a circuit breaker and bulkhead (#285). Other routes have no limit yet | `backend/src/ai-request-budget.js` | Kenlie (#296) |
| 8 | Update your dependencies | ✅ | Dependabot opens grouped updates weekly; CI fails on high or critical advisories in shipped code, with dated exceptions only | `.github/dependabot.yml`, `security.yml`, `.github/audit-exceptions.json` | — |
| 9 | Sanitize your forms | ✅ | The API validates every body and parameter (types, UUIDs, lengths, JSON size limits) and checks uploaded files by magic bytes; the frontend checks type and size before upload; SQL is always parameterized | `backend/src/app.js`, `frontend/src/application-api.js` | — |
| 10 | Check env variables | 🟡 | Per-app `.env.example`, only public `VITE_` values reach the browser. #299 removes the unused `JWT_SECRET` and adds tests that keep each example in step with the code | `.env.example`, `backend/test/env-example.test.js` | Anthony (#293) |
| 11 | Hash passwords | ✅ | TSEK never receives a password: the browser signs in directly with Neon Auth, which stores and hashes them. The API only sees signed tokens | `frontend/src`, `docs/ARCHITECTURE.md` | — |
| 12 | Turn off debug mode | 🟡 | The error handler returns a generic `500` with a request ID, never a stack trace; `x-powered-by` is off; the build has no source maps. #299 requires `NODE_ENV=production` on Render and warns when it is missing | `backend/src/app.js`, `backend/src/server.js` | Anthony (#293) |
| 13 | Protect admin routes | ✅ | Everything under `/api/admin` runs `requireStaff`, which reads the role from the database on every request; the `#/admin` page grants nothing by itself | `backend/src/staff-routes.js`, `backend/test/staff.test.js` | — |
| 14 | Check for exposed files | 🟡 | No `.env` or key files in Git (Gitleaks, full history). #300 fails the bundle audit on source maps, dotfiles, env files, keys, dumps, backups, logs, archives or config in the build | `.github/scripts/exposed-files.mjs` | Anthony (#294) |
| 15 | Penetration test with Strix | 🔴 | Manual workflow against staging (this page, below). Run it after #297–#300 merge | `.github/workflows/pentest.yml` | Anthony (#295) |

## Who owns which guardrail

The course guide names no single owner for security, so the team splits it
by role: whoever owns the code owns its guardrail, and the DevOps engineer
owns everything about keys, hosting and the pipeline. "Owner" means the
person who keeps it working, fixes it when it breaks and explains it at Demo
Day. Every change still needs a teammate's review.

### AI guardrails: Axel (AI Engineer)

| Guardrail | Where | Status |
|---|---|---|
| Treat document text as data: instructions in the prompt, directive lines stripped before the call | `extraction-prompt.v1.js`, `extraction.js` | ✅ |
| Delimit untrusted text in `<document>` tags | #287 | 🟡 needs the live eval |
| Structured output with a strict schema, then validation | `analysis.js`, `schema/` | ✅ |
| Evidence check: a value not found in the document is removed | `extraction.js` (`keepSupportedValues`) | ✅ |
| No secrets in prompts | `extraction-prompt.v1.js` | ✅ |
| Model settings: `max_tokens`, temperature 0, timeout, retry | `provider.js` | ✅ |
| Attacks in the eval set (case 15, prompt injection) and evals on every prompt change | `test/fixtures/document-evaluation-v1/`, `scripts/eval/` | ✅ |
| AI results are advisory: staff make every decision | `docs/staff-dashboard.md` | ✅ (with Hero) |

### API guardrails: Kenlie (Backend / API)

| Guardrail | Where | Status |
|---|---|---|
| Authentication: JWT signature, issuer, subject, expiry | `auth.js` | ✅ |
| Owner scoping on every query (no IDOR), `404` for others' records | `applications.js`, `application-files.js` | ✅ |
| Input validation and body size limits (`400`, `413`) | `app.js` | ✅ |
| AI budget: 3/min and 20/day per user, 60/h overall | `ai-request-budget.js` | ✅ |
| Rate limiting on every route | #296 | 🔴 |
| Circuit breaker and bulkhead on AI calls | #285 | 🟡 handed over |
| Request traces for investigating abuse | #282 | 🟡 handed over |
| Generic `500` with a request ID, never a stack trace | `app.js` | ✅ |

### Staff and frontend guardrails: Hero (Frontend), with Francis

| Guardrail | Where | Status |
|---|---|---|
| Admin routes check the staff role on every request | `staff-routes.js`, `staff.js` | ✅ |
| Human approval: staff approve or reject, the AI never decides | `StaffDashboard.tsx` | ✅ |
| No `innerHTML`; React escapes AI output | `frontend/src` | ✅ |
| File type and size checked before upload | `application-api.js` | ✅ |
| The app still works under the new CSP (check on the Vercel preview) | #297 | 🟡 |

### Keys, hosting and pipeline guardrails: Anthony (DevOps)

| Guardrail | Where | Status |
|---|---|---|
| Secrets only in host settings, one key per environment | Render, GitHub, Vercel | ✅ |
| OpenAI spend caps and usage alerts (Anthony manages the OpenAI account) | `docs/MAINTENANCE.md` §6 | ✅ |
| AI kill switch `AI_VERIFY_ENABLED` | Render | ✅ |
| Secret scan, dependency audits, bundle audit, exposed-files check | `security.yml`, `bundle-audit.yml`, #300 | 🟡 #300 open |
| Mocked AI tests in CI; a provider outage never blocks a deploy | `ci.yml`, `ai-smoke.yml` | ✅ |
| Security headers and CSP (config) | #297 | 🟡 |
| Least-privilege database role | #298 | 🟡 |
| Env clean-up, `NODE_ENV=production` | #299 | 🟡 |
| AI cost and validation log, signals dashboard | #281, #286 | 🟡 |
| Threat model, this review, the Strix pentest | #280, this page | 🟡 |
| Incident response and key rotation | `RUNBOOK.md` §4 | ✅ |

### Cross-checks: Francis (Full-stack)

- Authenticated live acceptance on staging, including the AI failure drill (#40).
- Reviews the security PRs above.
- Owns the Render account and created the Neon project, so the Render
  environment changes in #298 and #299 (new `DATABASE_URL`, delete
  `JWT_SECRET`, add `NODE_ENV`) need his access or him.

## Penetration test (Strix)

[Strix](https://github.com/usestrix/strix) runs AI pentesting agents against
a live app and its source code, and validates each finding with a proof of
concept. Only test systems we own: **staging**, never production. The rules
of engagement the agents get are in
[`.github/strix/instructions.md`](../.github/strix/instructions.md):
staging only, no denial of service or brute force, at most 10 AI analyses,
only the test accounts, clean up afterwards. Access control (one account
reading another's applications) is the first thing it checks.

### One-time setup (Settings → Environments → staging)

| Name | Type | Value |
|---|---|---|
| `STRIX_LLM_API_KEY` | Secret | A key from a **separate** OpenAI project with a low monthly budget. Never the production key |
| `STRIX_REPORT_PASSPHRASE` | Secret | `openssl rand -hex 32`; keep it in the team's password manager |
| `STRIX_TEST_ACCOUNTS` | Secret (optional) | Two staging-only citizen accounts, `email:password;email:password`. Without them Strix tests only what anyone can reach |
| `FRONTEND_URL`, `BACKEND_HEALTHCHECK_URL` | Variables | Already set for the AI smoke test |

### Run it

1. **Actions → Penetration test (Strix) → Run workflow.** Start with
   `quick`. `standard` is deeper and costs more.
2. The workflow refuses to start if a target is a production host.
3. The repository is public, so the job log and summary only say whether
   anything was found. The full report is uploaded as
   `strix-report-encrypted` and kept 14 days.
4. Decrypt it locally:
   `gpg --decrypt strix-report.tar.gz.gpg | tar xz`, then read
   `strix_runs/` (or open it with `strix view`).

To run it on your own computer instead (needs Docker running):

```bash
pipx install strix-agent==1.7.0
export STRIX_LLM=openai/gpt-4.1-mini LLM_API_KEY=<capped key>
strix -n -t ./ -t <staging frontend URL> -t <staging API URL> \
  --scan-mode quick --instruction "$(cat .github/strix/instructions.md)"
```

### After a run

- File one **Bug** issue per high or critical finding, without the exploit
  details in the public issue text (describe the area and severity; keep
  the proof in the encrypted report).
- Fix, then re-run to confirm.
- Record the run below.

| Date | Mode / model | Findings (critical / high / medium / low) | Issues | Re-test |
|---|---|---|---|---|
| — | — | Not run yet | — | — |
