# Backend requirements and evidence for #34

| Behavior | Automated evidence | Deployment evidence |
|---|---|---|
| Application CRUD requires an authenticated owner. Only drafts can be edited or deleted. | [Application route tests](../backend/test/applications.test.js), [CRUD test PR](https://github.com/Anthonyiwnl/tsek/pull/113), [edit/delete PR](https://github.com/Anthonyiwnl/tsek/pull/147). | [Staging API](https://tsek-api-staging.onrender.com/health). Verify with two synthetic users before recording a result. |
| Files are private, limited to 2 MiB and ten per application, and writable only on owned drafts. | [File tests](../backend/test/application-files.test.js), [upload PR](https://github.com/Anthonyiwnl/tsek/pull/153). | Check valid, oversized, and cross-owner uploads on staging. |
| Analysis runs on owned draft files, validates the extractor result and persists checklist decisions. | [Analysis route tests](../backend/test/application-analyses.test.js), [analysis PR](https://github.com/Anthonyiwnl/tsek/pull/154). | Use an owned synthetic text upload and verify the saved result and checklist on staging. |
| Bad input, database failures and AI failures return safe errors. | [Server tests](../backend/test/server.test.js), [file tests](../backend/test/application-files.test.js), [AI failure flow tests](../backend/test/ai-failure-flow.test.js). | Follow the [staging AI failure drill](AI_FAILURE_DRILL.md) with synthetic input. |
| AI calls require authentication and share persistent limits. They cap output, retry transient failures once, and log only operational metadata. | [Quota database tests](../backend/test/ai-request-budget.test.js), [route tests](../backend/test/application-analyses.test.js), [provider tests](../backend/test/provider.test.js). | After migration 005 and deploy, verify anonymous `/api/verify` returns `401`. With one staging test account, alternate both routes and verify the fourth valid request in the same UTC minute returns `429` with `Retry-After`. Check the Render `ai_call` entries for the admitted requests. |
| Replacement and reanalysis preserve the current checklist. | [Issue #30](https://github.com/Anthonyiwnl/tsek/issues/30). | Verify upload, analysis, replacement, and refreshed checklist on staging after #30 is available. |

This change still requires deployed validation. Record the staging commit from
[`/health`](https://tsek-api-staging.onrender.com/health), HTTP statuses, and
request IDs when the checks run. Use synthetic files and omit tokens and
document contents from the evidence.
